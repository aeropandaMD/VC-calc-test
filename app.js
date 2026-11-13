(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const modes = {
    basic: { title: 'Калькулятор', crumb: 'Калькулятор', description: 'Точные ответы на простые вопросы. Начните вычисление прямо сейчас.', guide: 'Введите выражение с помощью кнопок или клавиатуры и нажмите <strong>=</strong>, чтобы увидеть результат.', example: '128 × 4 + 36', value: '128*4+36' },
    scientific: { title: 'Научный калькулятор', crumb: 'Научный', description: 'Больше возможностей для идей, которые выходят за рамки обычного.', guide: 'Используйте степени, корни, скобки и тригонометрические функции. Угол можно задать в градусах или радианах.', example: 'sin(30) + sqrt(16)', value: 'sin(30)+sqrt(16)' },
    graph: { title: 'Графики функций', crumb: 'Графики', description: 'Превратите уравнения в линии и увидьте математику по-новому.' }
  };
  const basicKeys = [
    ['AC','clear','utility'],['⌫','back','utility'],['%','percent','utility'],['÷','/','operator'],
    ['7','7'],['8','8'],['9','9'],['×','*','operator'],
    ['4','4'],['5','5'],['6','6'],['−','-','operator'],
    ['1','1'],['2','2'],['3','3'],['+','+','operator'],
    ['±','sign','utility'],['0','0'],[',','.'],['=','equals','equals']
  ];
  const scienceKeys = [
    ['sin','sin('],['cos','cos('],['tan','tan('],['(', '('],[')',')'],
    ['xʸ','^'],['√','sqrt('],['∛','cbrt('],['π','pi'],['e','e']
  ];
  let mode = 'basic', angle = 'deg', lastEqual = false, history = [], plots = [], graphRange = [-10, 10], yBounds = [-1, 1], plotReady = false;
  const SAMPLE_COUNT = 1200;
  const colors = ['#5269ed','#ec9b59'];
  const mathReady = () => typeof window.math !== 'undefined';
  const format = (n) => {
    if (Object.is(n, -0) || Math.abs(n) < 1e-12) n = 0;
    if (!Number.isFinite(n)) return 'Не определено';
    const rounded = Number(n.toPrecision(12));
    if (Math.abs(rounded) >= 1e12 || (Math.abs(rounded) < 1e-7 && rounded !== 0)) return rounded.toExponential(5).replace('e+', 'e');
    return new Intl.NumberFormat('ru-RU', {maximumFractionDigits: 10}).format(rounded);
  };
  const safeMessage = (error) => {
    const text = String(error?.message || error || '');
    if (/zero|infinity|division/i.test(text)) return 'Деление на ноль невозможно.';
    if (/parenthesis|unexpected end|syntax|unexpected|value expected|expression expected/i.test(text)) return 'Проверьте выражение: возможно, пропущен знак или скобка.';
    if (/undefined symbol|not defined|unknown/i.test(text)) return 'Неизвестная переменная или функция. Проверьте написание.';
    return 'Не удалось вычислить выражение. Проверьте ввод и область определения.';
  };
  function parseSafe(source, withX = false, basic = false) {
    if (!mathReady()) throw Error('Библиотека вычислений не загрузилась. Проверьте подключение к интернету и обновите страницу.');
    const clean = source.trim().replace(/^y\s*=\s*/i, '').replace(/[×·]/g, '*').replace(/[÷]/g, '/').replace(/[−–]/g, '-').replace(/π/g, 'pi').replace(/,/g, '.');
    if (!clean) throw Error('Введите математическое выражение.');
    if (clean.length > 180) throw Error('Выражение слишком длинное (не более 180 символов).');
    const node = math.parse(clean);
    const allowed = new Set(['sin','cos','tan','sqrt','cbrt','abs']);
    node.traverse((part) => {
      if (part.isSymbolNode && ![...(withX ? ['x'] : []), 'pi','e', ...(basic ? [] : allowed)].includes(part.name)) throw Error('Неизвестная переменная или функция: ' + part.name);
      if (part.isFunctionNode && (basic || !part.fn.isSymbolNode || !allowed.has(part.fn.name) || part.args.length !== 1)) throw Error('Эта функция недоступна.');
      if (part.isOperatorNode && !(basic ? ['+','-','*','/'] : ['+','-','*','/','^']).includes(part.op)) throw Error('Недопустимая операция.');
      if (!['ConstantNode','SymbolNode','OperatorNode','ParenthesisNode','FunctionNode'].includes(part.type)) throw Error('Недопустимая конструкция в выражении.');
    });
    return node.compile();
  }
  function createScope(isCalc = false) {
    const transform = (v) => angle === 'deg' && isCalc ? v * Math.PI / 180 : v;
    return {pi: Math.PI, e: Math.E, sin: (v) => Math.sin(transform(v)), cos: (v) => Math.cos(transform(v)), tan: (v) => {
      const radians = transform(v);
      return Math.abs(Math.cos(radians)) < 1e-12 ? NaN : Math.tan(radians);
    }, sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs};
  }
  function evaluate(compiled, x, isCalc = false, scope = createScope(isCalc)) {
    if (x !== undefined) scope.x = x;
    const result = compiled.evaluate(scope);
    if (typeof result !== 'number' || !Number.isFinite(result)) throw Error('Результат выходит за пределы области определения или произошло деление на ноль.');
    return result;
  }
  function showError(target, text) { target.textContent = text; target.hidden = false; }
  function clearError(target) { target.hidden = true; target.textContent = ''; }
  function drawKeys() {
    $('keypad').innerHTML = '';
    $('scientific-keys').innerHTML = '';
    for (const [label, value, kind] of basicKeys) addKey($('keypad'), label, value, kind || '');
    for (const [label, value] of scienceKeys) addKey($('scientific-keys'), label, value, 'science');
  }
  function addKey(container, label, value, kind) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'key ' + kind; button.textContent = label;
    button.setAttribute('aria-label', ({'AC':'Очистить','⌫':'Удалить символ','±':'Сменить знак','÷':'Разделить','×':'Умножить','−':'Вычесть','=':'Вычислить','√':'Квадратный корень','∛':'Кубический корень','xʸ':'Степень'})[label] || label);
    button.addEventListener('click', () => keyPress(value));
    container.append(button);
  }
  function keyPress(value) {
    const input = $('expression');
    if (value === 'equals') { calculate(); return; }
    clearError($('calc-error'));
    if (value === 'clear') { input.value = ''; $('result').textContent = '0'; input.focus(); return; }
    if (value === 'back') {
      const pos = input.selectionStart ?? input.value.length;
      if (pos > 0) { input.value = input.value.slice(0,pos-1) + input.value.slice(input.selectionEnd); input.setSelectionRange(pos-1,pos-1); }
      updatePreview(); input.focus(); return;
    }
    if (value === 'sign') {
      input.value = input.value ? '-(' + input.value + ')' : '-';
      updatePreview(); input.focus(); return;
    }
    if (value === 'percent') value = '/100';
    if (lastEqual && (/^[\d.(]/.test(value) || /^(sin|cos|tan|sqrt|cbrt)\($/.test(value) || value === 'pi' || value === 'e')) input.value = '';
    lastEqual = false;
    const start = input.selectionStart ?? input.value.length, end = input.selectionEnd ?? start;
    input.value = input.value.slice(0,start) + value + input.value.slice(end);
    input.focus(); input.setSelectionRange(start + value.length, start + value.length);
    updatePreview();
  }
  function updatePreview() {
    const source = $('expression').value.trim();
    if (!source) { $('result').textContent = '0'; return; }
    try { $('result').textContent = format(evaluate(parseSafe(source, false, mode === 'basic'), undefined, true)); $('result').classList.remove('error'); }
    catch { $('result').textContent = '…'; }
  }
  function calculate() {
    const source = $('expression').value.trim();
    clearError($('calc-error'));
    if (!source) { showError($('calc-error'), 'Введите выражение для вычисления.'); return; }
    try {
      const number = evaluate(parseSafe(source, false, mode === 'basic'), undefined, true);
      const answer = format(number);
      $('result').textContent = answer; $('result').classList.remove('error');
      history.unshift({expression:source, answer, mode, time: new Date().toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'})});
      history = history.slice(0, 12); renderHistory(); lastEqual = true;
    } catch (err) {
      const message = /библиотека|длинное|недоступна|недопустим|области определения/i.test(err.message) ? err.message : safeMessage(err);
      $('result').textContent = 'Ошибка'; $('result').classList.add('error');
      showError($('calc-error'), message);
    }
  }
  function renderHistory() {
    const list = $('history-list'); list.replaceChildren();
    if (!history.length) {
      list.innerHTML = '<div class="empty-history"><div class="empty-icon"><svg class="icon"><use href="#i-clock"/></svg></div><strong>Пока здесь пусто</strong><p>Ваши вычисления появятся здесь после первого результата.</p></div>';
      return;
    }
    for (const item of history) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'history-entry';
      const detail = document.createElement('span'), expression = document.createElement('span'), answer = document.createElement('span'), time = document.createElement('span');
      expression.className = 'history-expression'; expression.textContent = item.expression;
      answer.className = 'history-answer'; answer.textContent = '= ' + item.answer;
      time.className = 'history-time'; time.textContent = item.time;
      detail.append(expression, answer); button.append(detail, time);
      button.title = 'Вернуть выражение';
      button.addEventListener('click', () => { switchMode(item.mode); $('expression').value = item.expression; updatePreview(); $('expression').focus(); });
      list.append(button);
    }
  }
  function switchMode(next) {
    mode = next; const data = modes[next];
    document.querySelectorAll('[data-mode]').forEach(el => el.classList.toggle('active', el.dataset.mode === next));
    $('page-title').innerHTML = data.title + '<span class="title-period">.</span>';
    $('page-description').textContent = data.description; $('breadcrumb-current').textContent = data.crumb;
    $('calculator-view').hidden = next === 'graph'; $('graph-view').hidden = next !== 'graph';
    if (next !== 'graph') {
      $('calc-title').textContent = next === 'basic' ? 'Обычный калькулятор' : 'Научный калькулятор';
      $('calc-kicker').textContent = next === 'basic' ? '01' : '02';
      $('scientific-keys').hidden = next === 'basic'; $('scientific-controls').hidden = next === 'basic';
      $('angle-label').textContent = next === 'basic' ? 'Арифметика' : angle === 'deg' ? 'Градусы' : 'Радианы';
      $('guide-text').innerHTML = data.guide; $('example-text').textContent = data.example;
      $('expression').value = ''; $('result').textContent = '0'; $('result').classList.remove('error'); clearError($('calc-error')); lastEqual = false;
    } else if (!plotReady) { buildGraph(); } else { requestAnimationFrame(() => drawPlot()); }
  }
  function graphErrorText(err) {
    if (/библиотека|длинное|первую|диапазон|недопустим|недоступна|области определения|не удалось/i.test(err.message)) return err.message;
    return safeMessage(err);
  }
  function buildGraph() {
    clearError($('graph-error'));
    const first = $('function-one').value.trim(), second = $('function-two').value.trim();
    const minRaw = $('range-min').value, maxRaw = $('range-max').value;
    try {
      if (!first) throw Error('Введите первую функцию для построения графика.');
      if (!minRaw.trim() || !maxRaw.trim()) throw Error('Укажите обе границы диапазона X.');
      const min = Number(minRaw), max = Number(maxRaw);
      if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) throw Error('Неверный диапазон: нижняя граница должна быть меньше верхней.');
      if (max - min < 1e-8 || max - min > 1e8) throw Error('Выберите диапазон X шириной от 0,00000001 до 100 000 000.');
      const nextPlots = [first, second].filter(Boolean).map((source, i) => {
        const compiled = parseSafe(source, true, false);
        const scope = createScope();
        let finite = 0;
        const samples = Array.from({length:SAMPLE_COUNT+1}, (_, j) => {
          try {
            const y = evaluate(compiled, min + (max-min)*j/SAMPLE_COUNT, false, scope);
            finite++;
            return y;
          } catch { return NaN; }
        });
        if (!finite) throw Error('Функция ' + (i+1) + ' не определена в выбранном диапазоне.');
        return {source, samples, color:colors[i], description: describe(source)};
      });
      // Bounds and samples depend only on the expressions and X range, not on canvas size or theme.
      const all = nextPlots.flatMap(plot => plot.samples.filter(Number.isFinite)).sort((a,b) => a-b);
      let ymin = all[Math.floor((all.length-1)*.02)], ymax = all[Math.floor((all.length-1)*.98)];
      if (ymax-ymin < 1e-9) { ymin-=1; ymax+=1; }
      const padding=(ymax-ymin)*.12; ymin-=padding; ymax+=padding;
      if (ymin>0 && ymin < (ymax-ymin)*.22) ymin=0;
      if (ymax<0 && -ymax < (ymax-ymin)*.22) ymax=0;
      yBounds = [ymin,ymax];
      plots = nextPlots; graphRange = [min,max]; plotReady = true;
      renderLegend(); renderDescriptions();
      requestAnimationFrame(() => drawPlot());
    } catch (err) { showError($('graph-error'), graphErrorText(err)); }
  }
  function renderLegend() {
    const legend = $('graph-legend'); legend.replaceChildren();
    plots.forEach((plot,i) => {
      const row = document.createElement('span'); row.className = 'legend-item';
      const line = document.createElement('span'); line.className = 'legend-line'; line.style.background = plot.color;
      const label = document.createElement('span'); label.textContent = 'Функция ' + (i+1) + ': y = ' + plot.source.replace(/^y\s*=\s*/i,'');
      row.append(line,label); legend.append(row);
    });
  }
  function renderDescriptions() {
    const container = $('transform-descriptions'); container.replaceChildren();
    plots.forEach((plot,i) => {
      const card = document.createElement('div'); card.className = 'description-item';
      const heading = document.createElement('h3'), dot = document.createElement('span'), text = document.createElement('p');
      dot.className = 'function-dot'; dot.style.background = plot.color;
      heading.append(dot,document.createTextNode('Функция ' + (i+1) + ' · y = ' + plot.source.replace(/^y\s*=\s*/i,'')));
      text.textContent = plot.description; card.append(heading,text); container.append(card);
    });
  }
  // Identify the common transformed form a·f(b(x−h))+k without guessing for unsupported expressions.
  function describe(source) {
    try {
      let node = math.parse(source.replace(/^y\s*=\s*/i,'').replace(/π/g,'pi'));
      const unwrap = n => { while (n?.isParenthesisNode) n=n.content; return n; };
      const constant = n => { try { const v = evaluate(n.compile()); return Number.isFinite(v) ? v : null; } catch { return null; } };
      node = unwrap(node);
      let k=0, a=1;
      if (node.isOperatorNode && ['+','-'].includes(node.op) && node.args.length===2) {
        const right=constant(node.args[1]), left=constant(node.args[0]);
        if (right!==null) { k=node.op==='+'?right:-right; node=unwrap(node.args[0]); }
        else if (left!==null && node.op==='+') { k=left; node=unwrap(node.args[1]); }
      }
      if (node.isOperatorNode && node.op==='-' && node.args.length===1) { a=-1; node=unwrap(node.args[0]); }
      if (node.isOperatorNode && node.op==='*') {
        const left=constant(node.args[0]), right=constant(node.args[1]);
        if (left!==null) { a*=left; node=unwrap(node.args[1]); }
        else if (right!==null) { a*=right; node=unwrap(node.args[0]); }
      }
      let family='', inner=null;
      if (node.isSymbolNode && node.name==='x') { family='линейной функции y = x'; inner=node; }
      else if (node.isOperatorNode && node.op==='^' && node.args.length===2 && constant(node.args[1])!==null) {
        const power=constant(node.args[1]); family=power===2?'параболы y = x²':power===3?'кубической функции y = x³':`степенной функции y = x^${format(power)}`; inner=node.args[0];
      } else if (node.isFunctionNode && node.args.length===1) {
        const names={sin:'синусоиды y = sin(x)',cos:'косинусоиды y = cos(x)',tan:'тангенса y = tan(x)',sqrt:'корневой функции y = √x',cbrt:'кубического корня y = ∛x',abs:'модуля y = |x|'};
        family=names[node.fn.name]; inner=node.args[0];
      } else if (node.isOperatorNode && node.op==='*') {
        const left=constant(node.args[0]), right=constant(node.args[1]);
        if (left!==null && unwrap(node.args[1]).isSymbolNode && unwrap(node.args[1]).name==='x') { a*=left; family='линейной функции y = x'; inner=node.args[1]; }
        else if (right!==null && unwrap(node.args[0]).isSymbolNode && unwrap(node.args[0]).name==='x') { a*=right; family='линейной функции y = x'; inner=node.args[0]; }
      }
      if (!family || !inner) return 'Для этой функции автоматическое определение преобразований недоступно. График построен по введённому выражению.';
      const innerCompiled=inner.compile();
      const v0=evaluate(innerCompiled,0), v1=evaluate(innerCompiled,1), v2=evaluate(innerCompiled,2);
      const b=v1-v0;
      if (!b || !Number.isFinite(b) || Math.abs(v2-2*v1+v0)>1e-8) return 'Для этой функции автоматическое определение преобразований недоступно. График построен по введённому выражению.';
      const h=-v0/b, parts=[];
      if (Math.abs(h)>1e-9) parts.push(`смещение ${h>0?'вправо':'влево'} на ${format(Math.abs(h))}`);
      if (Math.abs(k)>1e-9) parts.push(`смещение ${k>0?'вверх':'вниз'} на ${format(Math.abs(k))}`);
      if (Math.abs(Math.abs(b)-1)>1e-9) parts.push(`${Math.abs(b)>1?'сжатие':'растяжение'} по горизонтали в ${format(Math.abs(b)>1?Math.abs(b):1/Math.abs(b))} раза`);
      if (Math.abs(Math.abs(a)-1)>1e-9) parts.push(`${Math.abs(a)>1?'растяжение':'сжатие'} по вертикали в ${format(Math.abs(a)>1?Math.abs(a):1/Math.abs(a))} раза`);
      if (b<0) parts.push('отражение относительно оси Y');
      if (a<0) parts.push('отражение относительно оси X');
      return `Основа — график ${family}. ${parts.length ? 'Преобразования: '+parts.join('; ')+'.' : 'Преобразований нет.'}`;
    } catch { return 'Для этой функции автоматическое определение преобразований недоступно. График построен по введённому выражению.'; }
  }
  function niceStep(range, desired=8) {
    const raw=range/desired, exponent=Math.floor(Math.log10(raw)), magnitude=10**exponent;
    return [1,2,5,10].map(n=>n*magnitude).find(n=>n>=raw) || 10*magnitude;
  }
  function drawPlot(canvas=$('plot'), exportScale=1) {
    if (!plotReady || !canvas) return;
    const rect=canvas=== $('plot') ? canvas.getBoundingClientRect() : {width:1000,height:620};
    if (!rect.width || !rect.height) return;
    const dpr=(window.devicePixelRatio || 1)*exportScale, w=rect.width, h=rect.height;
    canvas.width=Math.round(w*dpr); canvas.height=Math.round(h*dpr);
    const ctx=canvas.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0);
    const dark=document.body.classList.contains('dark'), bg=dark?'#1c2637':'#ffffff', fg=dark?'#9ba9c2':'#8f9aaf', grid=dark?'#2b3951':'#edf0f6', axis=dark?'#73829b':'#aab5c5';
    ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
    const left=50,right=23,top=22,bottom=36, pw=w-left-right, ph=h-top-bottom, [xmin,xmax]=graphRange;
    const [ymin,ymax] = yBounds;
    const px=x=>left+(x-xmin)/(xmax-xmin)*pw, py=y=>top+(ymax-y)/(ymax-ymin)*ph;
    ctx.font='11px "DM Sans", sans-serif';ctx.lineWidth=1;
    const xstep=niceStep(xmax-xmin,w<440?5:8), ystep=niceStep(ymax-ymin,h<340?5:7);
    const gridLine=(value,vertical) => {
      const position=vertical?px(value):py(value);
      if(position<(vertical?left:top)-1||position>(vertical?left+pw:top+ph)+1)return;
      ctx.beginPath();ctx.strokeStyle=Math.abs(value)<xstep*1e-8?axis:grid;ctx.lineWidth=Math.abs(value)<xstep*1e-8?1.4:1;
      if(vertical){ctx.moveTo(position,top);ctx.lineTo(position,top+ph)}else{ctx.moveTo(left,position);ctx.lineTo(left+pw,position)}ctx.stroke();
      ctx.fillStyle=fg;
      const label=format(Number(value.toPrecision(4)));
      if(vertical){ctx.textAlign='center';ctx.fillText(label,position,top+ph+20)}
      else{ctx.textAlign='right';ctx.fillText(label,left-9,Math.min(top+ph-3,Math.max(top+10,position+4)))}
    };
    for(let i=Math.ceil(xmin/xstep);i<=Math.floor(xmax/xstep)&&i<Math.ceil(xmin/xstep)+100;i++)gridLine(i*xstep,true);
    for(let i=Math.ceil(ymin/ystep);i<=Math.floor(ymax/ystep)&&i<Math.ceil(ymin/ystep)+100;i++)gridLine(i*ystep,false);
    ctx.fillStyle=fg;ctx.font='700 12px "DM Sans", sans-serif';ctx.textAlign='right';ctx.fillText('X',w-7,top+ph+20);ctx.textAlign='left';ctx.fillText('Y',left-34,top+7);
    ctx.save();ctx.beginPath();ctx.rect(left,top,pw,ph);ctx.clip();
    plots.forEach((plot,index)=>{
      const values = plot.samples;
      ctx.strokeStyle=plot.color;ctx.lineWidth=2.8;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();let started=false;
      values.forEach((y,i)=>{
        const previous=values[i-1];
        // Break around holes and steep jumps rather than drawing across asymptotes.
        if(!Number.isFinite(y)||Math.abs(y)>1e15|| (i>0&&Number.isFinite(previous)&&Math.abs(y-previous)>2*(ymax-ymin))){started=false;return}
        const x=xmin+(xmax-xmin)*i/SAMPLE_COUNT, screenY=py(y);
        if(!started){ctx.moveTo(px(x),screenY);started=true}else ctx.lineTo(px(x),screenY);
      });ctx.stroke();
    });ctx.restore();
  }
  function exportGraph() {
    if(!plotReady)return;
    const offscreen=document.createElement('canvas');
    drawPlot(offscreen,2);
    const link=document.createElement('a');link.download='formula-graph.png';link.href=offscreen.toDataURL('image/png');link.click();
  }
  drawKeys();
  document.querySelectorAll('[data-mode]').forEach(el=>el.addEventListener('click',()=>switchMode(el.dataset.mode)));
  $('expression').addEventListener('input',()=>{clearError($('calc-error'));lastEqual=false;updatePreview()});
  $('expression').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();calculate()}if(e.key==='Escape'){e.preventDefault();keyPress('clear')}});
  $('clear-history').addEventListener('click',()=>{history=[];renderHistory()});
  $('try-example').addEventListener('click',()=>{$('expression').value=modes[mode].value;calculate();$('expression').focus()});
  document.querySelectorAll('[data-angle]').forEach(button=>button.addEventListener('click',()=>{angle=button.dataset.angle;document.querySelectorAll('[data-angle]').forEach(b=>b.classList.toggle('active',b===button));$('angle-label').textContent=angle==='deg'?'Градусы':'Радианы';updatePreview()}));
  $('graph-form').addEventListener('submit',e=>{e.preventDefault();buildGraph()});
  $('function-two').addEventListener('input',()=>{if(!$('function-two').value.trim()&&plotReady)buildGraph()});
  $('export-graph').addEventListener('click',exportGraph);
  const observer=new ResizeObserver(()=>{if(mode==='graph'&&plotReady)drawPlot()});observer.observe($('plot').parentElement);
  $('theme-toggle').addEventListener('click',()=>{document.body.classList.toggle('dark');$('theme-icon').firstElementChild.setAttribute('href',document.body.classList.contains('dark')?'#i-sun':'#i-moon');if(plotReady)drawPlot()});
})();

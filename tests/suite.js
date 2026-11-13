(() => {
  'use strict';
  const results = [];
  const summary = document.getElementById('summary');
  const list = document.getElementById('results');
  const frame = document.getElementById('app');
  const assert = (condition, message) => { if (!condition) throw Error(message); };
  const equal = (actual, expected) => assert(actual === expected, `Ожидалось «${expected}», получено «${actual}»`);
  const includes = (actual, expected) => assert(actual.includes(expected), `«${actual}» не содержит «${expected}»`);
  const tick = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  let doc, win, errors = [];
  const el = id => doc.getElementById(id);
  const click = selector => {
    const target = doc.querySelector(selector);
    assert(target, `Не найден элемент ${selector}`);
    target.click();
  };
  const set = (id, value) => {
    const target = el(id); target.value = value;
    target.dispatchEvent(new win.Event('input', {bubbles:true}));
  };
  const mode = name => click(`.side-link[data-mode="${name}"]`);
  const calc = (expression, name='basic') => {
    mode(name); set('expression', expression);
    el('expression').dispatchEvent(new win.KeyboardEvent('keydown', {key:'Enter', bubbles:true}));
    return el('result').textContent;
  };
  const graph = async (first, second='', min='-10', max='10') => {
    mode('graph'); set('function-one',first); set('function-two',second);
    set('range-min',min); set('range-max',max);
    el('graph-form').requestSubmit();
    await tick();
  };
  const test = async (name, body) => {
    try {
      await body();
      results.push({name, ok:true});
    } catch (error) {
      results.push({name, ok:false, error:String(error.stack || error)});
    }
    const item = document.createElement('li'); item.className = results.at(-1).ok ? 'pass' : 'fail';
    item.textContent = `${item.className === 'pass' ? '✓' : '✗'} ${name}`;
    if (results.at(-1).error) {
      const detail = document.createElement('pre'); detail.textContent = results.at(-1).error; item.append(detail);
    }
    list.append(item);
    summary.textContent = `Выполнено ${results.length} проверок…`;
  };
  const countColor = (data, wanted) => {
    let pixels=0;
    for(let i=0;i<data.length;i+=4) {
      if (Math.abs(data[i]-wanted[0])<13 && Math.abs(data[i+1]-wanted[1])<13 && Math.abs(data[i+2]-wanted[2])<13 && data[i+3]>200) pixels++;
    }
    return pixels;
  };
  async function run() {
    try {
      await new Promise((resolve,reject) => {
        const timeout = setTimeout(() => reject(Error('Приложение не загрузилось за 30 секунд')),30000);
        if (frame.contentDocument?.readyState === 'complete' && frame.contentWindow?.document.querySelector('#keypad .key')) {clearTimeout(timeout);resolve();return}
        frame.addEventListener('load',()=>{clearTimeout(timeout);resolve()},{once:true});
      });
      doc=frame.contentDocument; win=frame.contentWindow;
      win.addEventListener('error', e => errors.push(e.message));
      win.addEventListener('unhandledrejection', e => errors.push(String(e.reason)));
      assert(typeof win.math === 'object', 'math.js не загружен');

      await test('Обычный режим: приоритет операций, отрицательные и дробные числа', () => {
        equal(calc('2+3*4'),'14');
        equal(calc('(2-7)/2'),'-2,5');
        equal(calc('0,1+0,2'),'0,3');
      });
      await test('Кнопки: ввод, удаление, очистка, смена знака и процент', () => {
        mode('basic');
        click('#keypad .key:nth-child(5)'); // 7
        click('#keypad .key:nth-child(6)'); // 8
        equal(el('expression').value,'78');
        click('#keypad .key:nth-child(2)'); // backspace
        equal(el('expression').value,'7');
        click('#keypad .key:nth-child(17)'); // +/-
        equal(el('result').textContent,'-7');
        click('#keypad .key:nth-child(1)'); // AC
        equal(el('expression').value,'');
        set('expression','50');
        click('#keypad .key:nth-child(3)'); // %
        equal(el('result').textContent,'0,5');
      });
      await test('Обычный режим: ошибки деления на ноль и неверного синтаксиса', () => {
        equal(calc('3/0'),'Ошибка');
        includes(el('calc-error').textContent,'деление на ноль');
        equal(calc('2+('),'Ошибка');
        assert(!el('calc-error').hidden,'Сообщение об ошибке должно быть видно');
      });
      await test('Обычный режим не выполняет произвольный код и научные функции', () => {
        equal(calc('sin(30)'),'Ошибка');
        equal(calc('1;2'),'Ошибка');
        equal(calc('x+2'),'Ошибка');
        equal(calc('a=2'),'Ошибка');
      });
      await test('История: результат добавляется, восстанавливается и очищается', () => {
        equal(calc('12*3'),'36');
        assert(el('history-list').querySelectorAll('.history-entry').length>0,'История не пополнилась');
        mode('scientific'); click('#history-list .history-entry');
        equal(el('expression').value,'12*3');
        assert(doc.querySelector('.side-link[data-mode="basic"]').classList.contains('active'),'Режим истории не восстановлен');
        click('#clear-history');
        equal(el('history-list').querySelectorAll('.history-entry').length,0);
      });
      await test('Научный режим: степени, корни и скобки', () => {
        equal(calc('(2+3)^2','scientific'),'25');
        equal(calc('sqrt(16)+cbrt(27)','scientific'),'7');
        equal(calc('2^(-3)','scientific'),'0,125');
      });
      await test('Научный режим: градусы и радианы', () => {
        click('[data-angle="deg"]');
        equal(calc('sin(30)','scientific'),'0,5');
        click('[data-angle="rad"]');
        equal(calc('sin(pi/2)','scientific'),'1');
        click('[data-angle="deg"]');
      });
      await test('Научный режим: некорректная область определения', () => {
        equal(calc('sqrt(-1)','scientific'),'Ошибка');
        includes(el('calc-error').textContent,'области определения');
        equal(calc('tan(90)','scientific'),'Ошибка');
      });
      await test('Научный режим: неверная функция и слишком длинное выражение', () => {
        equal(calc('log(2)','scientific'),'Ошибка');
        equal(calc('1'.repeat(181),'scientific'),'Ошибка');
        includes(el('calc-error').textContent,'слишком длинное');
      });
      await test('Первый график строится без второй функции', async () => {
        await graph('x^2');
        equal(el('graph-legend').querySelectorAll('.legend-item').length,1);
        assert(el('plot').width>0 && el('plot').height>0,'Canvas пуст');
        includes(el('transform-descriptions').textContent,'параболы');
        assert(el('graph-error').hidden,'Ошибка у корректной функции');
      });
      await test('Две функции имеют собственные цвета и общий холст', async () => {
        await graph('x^2','2x+1');
        equal(el('graph-legend').querySelectorAll('.legend-item').length,2);
        equal(el('transform-descriptions').querySelectorAll('.description-item').length,2);
        const canvas=el('plot'), data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
        assert(countColor(data,[82,105,237])>10,'Синяя линия не нарисована');
        assert(countColor(data,[236,155,89])>10,'Оранжевая линия не нарисована');
      });
      await test('Удаление второй функции автоматически убирает её график', async () => {
        set('function-two',''); await tick();
        equal(el('graph-legend').querySelectorAll('.legend-item').length,1);
        equal(el('transform-descriptions').querySelectorAll('.description-item').length,1);
      });
      await test('Перестроение обновляет формулы и диапазон', async () => {
        await graph('sin(x)','cos(x)','-4','4');
        includes(el('graph-legend').textContent,'sin(x)');
        includes(el('graph-legend').textContent,'cos(x)');
        includes(el('plot').toDataURL(),'data:image/png');
      });
      await test('График: преобразования двух функций описываются отдельно', async () => {
        await graph('-2*(x-3)^2+4','sqrt(-x)');
        const items=el('transform-descriptions').querySelectorAll('.description-item');
        includes(items[0].textContent,'вправо на 3');
        includes(items[0].textContent,'вверх на 4');
        includes(items[0].textContent,'отражение относительно оси X');
        includes(items[1].textContent,'отражение относительно оси Y');
      });
      await test('График: сложная функция получает честное описание-заглушку', async () => {
        await graph('x^2+sin(x)');
        includes(el('transform-descriptions').textContent,'определение преобразований недоступно');
      });
      await test('График: пустая первая функция и необязательная вторая', async () => {
        await graph('','x+1');
        includes(el('graph-error').textContent,'первую функцию');
      });
      await test('График: пустой, обратный и нулевой диапазоны', async () => {
        await graph('x','','','10');
        includes(el('graph-error').textContent,'обе границы');
        await graph('x','','10','-10');
        includes(el('graph-error').textContent,'Неверный диапазон');
        await graph('x','','1','1');
        includes(el('graph-error').textContent,'Неверный диапазон');
      });
      await test('График: функция вне области определения и частичная область', async () => {
        await graph('sqrt(-1)');
        includes(el('graph-error').textContent,'не определена');
        await graph('sqrt(x)');
        assert(el('graph-error').hidden,'Частичная область определения допустима');
      });
      await test('График: неизвестные символы и опасные конструкции отклоняются', async () => {
        await graph('foo(x)');
        assert(!el('graph-error').hidden,'Неизвестную функцию следует отклонить');
        await graph('x=3');
        assert(!el('graph-error').hidden,'Присваивание следует отклонить');
      });
      await test('Экспорт PNG содержит оба графика', async () => {
        await graph('x^2','2x+1');
        let captured;
        const original=win.HTMLAnchorElement.prototype.click;
        win.HTMLAnchorElement.prototype.click=function(){captured={name:this.download,data:this.href}};
        try { click('#export-graph'); } finally { win.HTMLAnchorElement.prototype.click=original; }
        equal(captured?.name,'formula-graph.png');
        assert(captured.data.startsWith('data:image/png;base64,'),'Экспорт не PNG');
        const img=new win.Image();img.src=captured.data;await img.decode();
        const canvas=doc.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
        canvas.getContext('2d').drawImage(img,0,0);
        const data=canvas.getContext('2d').getImageData(0,0,img.width,img.height).data;
        assert(countColor(data,[82,105,237])>100,'На PNG отсутствует график 1');
        assert(countColor(data,[236,155,89])>100,'На PNG отсутствует график 2');
      });
      await test('Изменение темы и экспорт не пересчитывают точки графика', async () => {
        await graph('sin(x)');
        const originalSin = win.Math.sin;
        const originalClick = win.HTMLAnchorElement.prototype.click;
        let calls = 0;
        win.Math.sin = (...args) => { calls++; return originalSin(...args); };
        win.HTMLAnchorElement.prototype.click = function(){};
        try {
          click('#theme-toggle');
          await tick();
          click('#export-graph');
          equal(calls,0);
        } finally {
          win.Math.sin = originalSin;
          win.HTMLAnchorElement.prototype.click = originalClick;
          if (doc.body.classList.contains('dark')) click('#theme-toggle');
        }
      });
      await test('Переключение темы и возврат к калькулятору без ошибок', async () => {
        click('#theme-toggle');assert(doc.body.classList.contains('dark'),'Тёмная тема не включилась');
        click('#theme-toggle');assert(!doc.body.classList.contains('dark'),'Светлая тема не включилась');
        mode('basic');equal(calc('8/2'),'4');
        mode('graph');await tick();assert(el('plot').width>0,'График не перерисовался');
      });
      await test('Нет ошибок JavaScript во время проверки', () => assert(!errors.length,errors.join('\n')));
    } catch (error) {
      await test('Загрузка приложения и запуск тестов', () => { throw error; });
    }
    const failed=results.filter(r=>!r.ok).length;
    summary.textContent = `${results.length-failed}/${results.length} успешно${failed ? `, ошибок: ${failed}` : ''}`;
    summary.className = failed ? 'failed' : 'passed';
    window.__testResults = {done:true,passed:results.length-failed,failed,results};
  }
  run();
})();

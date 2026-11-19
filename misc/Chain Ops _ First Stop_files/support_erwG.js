(function () {
  'use strict';

  function evaluate(expression, scope) {
    expression = expression.replace(/^{{\s*|\s*}}$/g, '').trim();
    const names = Object.keys(scope);
    try {
      return Function(...names, 'return (' + expression + ')')(...names.map((name) => scope[name]));
    } catch (error) {
      console.warn('[dc] Could not evaluate:', expression, error);
      return '';
    }
  }

  function interpolate(value, scope) {
    return value.replace(/{{\s*([\s\S]*?)\s*}}/g, function (_, expression) {
      const result = evaluate(expression, scope);
      return result == null ? '' : String(result);
    });
  }

  class DCLogic {
    constructor(props) {
      this.props = props || {};
      this.state = {};
      this._render = function () {};
    }

    setState(next) {
      this.state = Object.assign({}, this.state, next);
      this._render();
    }
  }

  function renderNode(node, scope, events) {
    if (node.nodeType === Node.TEXT_NODE) return interpolate(node.nodeValue, scope);
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    if (node.tagName.toLowerCase() === 'sc-if') {
      const visible = evaluate(node.getAttribute('value') || 'false', scope);
      return visible ? Array.from(node.childNodes).map((child) => renderNode(child, scope, events)).join('') : '';
    }

    if (node.tagName.toLowerCase() === 'sc-for') {
      const list = evaluate(node.getAttribute('list') || '[]', scope) || [];
      const itemName = node.getAttribute('as') || 'item';
      return list.map((item) => {
        const childScope = Object.assign({}, scope, { [itemName]: item });
        return Array.from(node.childNodes).map((child) => renderNode(child, childScope, events)).join('');
      }).join('');
    }

    const clone = node.cloneNode(false);
    Array.from(node.attributes).forEach((attribute) => {
      const name = attribute.name;
      const value = attribute.value;
      const lowerName = name.toLowerCase();
      if (lowerName === 'onclick' || lowerName === 'onchange' || lowerName === 'oninput') {
        const expression = value.replace(/^{{\s*|\s*}}$/g, '');
        const id = String(events.length);
        events.push({ id: id, type: lowerName.slice(2), handler: evaluate(expression, scope) });
        clone.removeAttribute(name);
        clone.setAttribute('data-dc-event-' + id, 'true');
        return;
      }
      if (lowerName === 'style-hover' || lowerName === 'hint-placeholder-count' || lowerName === 'hint-placeholder-val') return;
      if (lowerName === 'data-dc-value') {
        clone.setAttribute('value', interpolate(value, scope));
        return;
      }
      clone.setAttribute(name, interpolate(value, scope));
    });
    clone.innerHTML = Array.from(node.childNodes).map((child) => renderNode(child, scope, events)).join('');
    return clone.outerHTML;
  }

  function mount() {
    const host = document.querySelector('x-dc');
    const dcScript = document.querySelector('script[data-dc-script]');
    if (!host || !dcScript) return;

    const helmet = host.querySelector('helmet');
    if (helmet) document.head.insertAdjacentHTML('beforeend', helmet.innerHTML);
    const sourceRoot = Array.from(host.children).find((child) => child.tagName.toLowerCase() === 'div');
    if (!sourceRoot) return;
    const template = sourceRoot.outerHTML;
    const props = JSON.parse(dcScript.getAttribute('data-props') || '{}');
    const config = {};
    Object.keys(props).forEach((key) => { config[key] = props[key].default; });
    const source = dcScript.textContent;
    const Component = Function('DCLogic', source + '\nreturn Component;')(DCLogic);
    const component = new Component(config);
    const root = document.createElement('div');
    host.replaceChildren(root);
    document.title = 'Chain Ops | First Stop';

    component._render = function () {
      const values = component.renderVals();
      const scope = Object.assign({}, values);
      const events = [];
      root.innerHTML = renderNode(sourceRoot, scope, events);
      events.forEach((event) => {
        const target = root.querySelector('[data-dc-event-' + event.id + ']');
        if (!target || typeof event.handler !== 'function') return;
        target.addEventListener(event.type, event.handler);
        target.removeAttribute('data-dc-event-' + event.id);
      });
    };
    component._render();
  }

  window.DCLogic = DCLogic;
  window.addEventListener('DOMContentLoaded', mount);
}());

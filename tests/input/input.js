/* global describe, it */

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect } from 'chai'; // eslint-disable-line import/no-extraneous-dependencies
import { defer } from '../../src/utils/defer';
import Input from '../../src';

document.body.innerHTML = '<div id="container"></div>';
const container = document.getElementById('container');

let currentRoot = null;
let currentRefCallback = null;

// Use the native value setter to bypass React's input value tracker.
// React installs a custom value property on input elements to detect changes.
// When setting value programmatically in tests, we need to bypass the tracker
// so that dispatching native events correctly triggers React's onChange handler.
const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
  HTMLInputElement.prototype, 'value'
).set;

const setNativeInputValue = (node, value) => {
  nativeInputValueSetter.call(node, value);
};

const fireInputEvent = (node) => {
  node.dispatchEvent(new Event('input', { bubbles: true }));
};

const firePasteEvent = (node) => {
  node.dispatchEvent(new Event('paste', { bubbles: true, cancelable: true }));
};

const getInputDOMNode = (input) => {
  return input.getInputDOMNode();
};

const createInput = (component, cb) => {
  return () => {
    let input;

    if (currentRoot) {
      currentRoot.unmount();
    }
    currentRoot = createRoot(container);

    currentRefCallback = (ref) => {
      if (ref) input = ref;
    };

    component = React.cloneElement(component, {
      ref: currentRefCallback
    });

    return new Promise((resolve, reject) => {
      act(() => {
        currentRoot.render(component);
      });

      // IE can fail if executed synchronously
      setImmediate(() => {
        const inputNode = getInputDOMNode(input);
        Promise.resolve(cb(input, inputNode))
          .then(() => {
            currentRoot.unmount();
            currentRoot = null;
            resolve();
          })
          .catch((err) => {
            currentRoot.unmount();
            currentRoot = null;
            reject(err);
          });
      });
    });
  };
};

const setInputSelection = (input, start, length) => {
  const end = start + length;
  if ('selectionStart' in input && 'selectionEnd' in input) {
    input.selectionStart = start;
    input.selectionEnd = end;
  } else {
    const range = input.createTextRange();
    range.collapse(true);
    range.moveStart('character', start);
    range.moveEnd('character', end - start);
    range.select();
  }
};

const setInputProps = (input, props) => {
  act(() => {
    currentRoot.render(React.createElement(Input, { ...input.props, ...props, ref: currentRefCallback }));
  });
};

const insertStringIntoInput = (input, str) => {
  const inputNode = getInputDOMNode(input);
  const selection = input.getSelection();
  const { value } = inputNode;

  setNativeInputValue(inputNode, value.slice(0, selection.start) + str + value.slice(selection.end));

  setInputSelection(inputNode, selection.start + str.length, 0);

  fireInputEvent(inputNode);
};

const simulateInputKeyPress = insertStringIntoInput;

const simulateInputPaste = (input, str) => {
  const inputNode = getInputDOMNode(input);

  firePasteEvent(inputNode);

  insertStringIntoInput(input, str);
};

const simulateInputBackspacePress = (input) => {
  const inputNode = getInputDOMNode(input);
  const selection = input.getSelection();
  const { value } = inputNode;

  if (selection.length) {
    setNativeInputValue(inputNode, value.slice(0, selection.start) + value.slice(selection.end));
    setInputSelection(inputNode, selection.start, 0);
  } else if (selection.start) {
    setNativeInputValue(inputNode, value.slice(0, selection.start - 1) + value.slice(selection.end));
    setInputSelection(inputNode, selection.start - 1, 0);
  }

  fireInputEvent(inputNode);
};

const simulateInputDeletePress = (input) => {
  const inputNode = getInputDOMNode(input);
  const selection = input.getSelection();
  let { value } = inputNode;

  if (selection.length) {
    value = value.slice(0, selection.start) + value.slice(selection.end);
  } else if (selection.start < value.length) {
    value = value.slice(0, selection.start) + value.slice(selection.end + 1);
  }
  setNativeInputValue(inputNode, value);

  setInputSelection(inputNode, selection.start, 0);

  fireInputEvent(inputNode);
};

const TestInputComponent = (props) => {
  return <div><input {...props} /></div>;
};

const TestFunctionalInputComponent = (props) => {
  return <div><div><input {...props} /></div></div>;
};

describe('react-input-mask', () => {
  it('should format value on mount', createInput(
    <Input mask="+7 (999) 999 99 99" defaultValue="74953156454" />, (input, inputNode) => {
      expect(inputNode.value).to.equal('+7 (495) 315 64 54');
    }));

  it('should format value with invalid characters on mount', createInput(
    <Input mask="+7 (9a9) 999 99 99" defaultValue="749531b6454" />, (input, inputNode) => {
      expect(inputNode.value).to.equal('+7 (4b6) 454 __ __');
    }));

  it('should show placeholder on focus', createInput(
    <Input mask="+7 (*a9) 999 99 99" />, (input, inputNode) => {
      expect(inputNode.value).to.equal('');

      inputNode.focus();
      expect(inputNode.value).to.equal('+7 (___) ___ __ __');
    }));

  it('should clear input on blur', createInput(
    <Input mask="+7 (*a9) 999 99 99" />, (input, inputNode) => {
      inputNode.focus();
      expect(inputNode.value).to.equal('+7 (___) ___ __ __');

      inputNode.blur();
      expect(inputNode.value).to.equal('');

      inputNode.focus();
      simulateInputKeyPress(input, '1');
      expect(inputNode.value).to.equal('+7 (1__) ___ __ __');

      inputNode.blur();
      expect(inputNode.value).to.equal('+7 (1__) ___ __ __');
    }));

  it('should handle escaped characters in mask', createInput(
    <Input mask="+4\9 99 9\99 99" maskChar={null} />, (input, inputNode) => {
      inputNode.focus();

      setNativeInputValue(inputNode, '+49 12 3');
      setInputSelection(inputNode, 8, 0);
      fireInputEvent(inputNode);
      expect(inputNode.value).to.equal('+49 12 39');
    }));

  it('should handle alwaysShowMask', createInput(
    <Input mask="+7 (999) 999 99 99" alwaysShowMask />, (input, inputNode) => {
      expect(inputNode.value).to.equal('+7 (___) ___ __ __');

      inputNode.focus();
      expect(inputNode.value).to.equal('+7 (___) ___ __ __');

      inputNode.blur();
      expect(inputNode.value).to.equal('+7 (___) ___ __ __');

      setInputProps(input, { alwaysShowMask: false });
      expect(inputNode.value).to.equal('');

      setInputProps(input, { alwaysShowMask: true });
      expect(inputNode.value).to.equal('+7 (___) ___ __ __');
    }));

  it('should adjust cursor position on focus', createInput(
    <Input mask="+7 (999) 999 99 99" value="+7" />, (input, inputNode) => {
      inputNode.focus();

      expect(input.getCursorPosition()).to.equal(4);

      inputNode.blur();

      setInputProps(input, { value: '+7 (___) ___ _1 __' });
      setInputSelection(inputNode, 2, 0);
      inputNode.focus();
      expect(input.getCursorPosition()).to.equal(16);

      inputNode.blur();

      setInputProps(input, { value: '+7 (___) ___ _1 _1' });
      setInputSelection(inputNode, 2, 0);
      inputNode.focus();
      expect(input.getCursorPosition()).to.equal(2);
    }));

  it('should adjust cursor position on focus on input with autoFocus', createInput(
    <Input mask="+7 (999) 999 99 99" value="+7" autoFocus />, (input, inputNode) => {
      expect(input.getCursorPosition()).to.equal(4);

      inputNode.blur();

      setInputProps(input, { value: '+7 (___) ___ _1 __' });
      setInputSelection(inputNode, 2, 0);
      inputNode.focus();
      expect(input.getCursorPosition()).to.equal(16);

      inputNode.blur();

      setInputProps(input, { value: '+7 (___) ___ _1 _1' });
      setInputSelection(inputNode, 2, 0);
      inputNode.focus();
      expect(input.getCursorPosition()).to.equal(2);
    }));

  it('should handle changes on input with autoFocus', createInput(
    <Input mask="+7 (999) 999 99 99" autoFocus />, (input, inputNode) => {
      insertStringIntoInput(input, '222 222 22 22');

      return new Promise((resolve) => {
        defer(() => {
          setInputSelection(inputNode, 5, 0);
          setTimeout(() => {
            simulateInputKeyPress(input, '3');
            expect(inputNode.value).to.equal('+7 (232) 222 22 22');
            resolve();
          }, 100);
        });
      });
    }));

  it('should format value in onChange (with maskChar)', createInput(
    <Input mask="**** **** **** ****" />, (input, inputNode) => {
      inputNode.focus();

      setInputSelection(inputNode, 0, 0);
      setNativeInputValue(inputNode, 'a' + inputNode.value);
      setInputSelection(inputNode, 1, 0);
      fireInputEvent(inputNode);
      expect(inputNode.value).to.equal('a___ ____ ____ ____');
      expect(input.getCursorPosition()).to.equal(1);

      setInputSelection(inputNode, 0, 19);
      setNativeInputValue(inputNode, 'a');
      setInputSelection(inputNode, 1, 0);
      fireInputEvent(inputNode);
      expect(inputNode.value).to.equal('a___ ____ ____ ____');
      expect(input.getCursorPosition()).to.equal(1);

      setNativeInputValue(inputNode, 'aaaaa___ ____ ____ ____');
      setInputSelection(inputNode, 1, 4);
      fireInputEvent(inputNode);
      expect(inputNode.value).to.equal('aaaa a___ ____ ____');
      expect(input.getCursorPosition()).to.equal(6);

      input.setCursorPosition(4);
      setNativeInputValue(inputNode, 'aaa a___ ____ ____');
      setInputSelection(inputNode, 3, 0);
      fireInputEvent(inputNode);
      expect(inputNode.value).to.equal('aaa_ a___ ____ ____');

      input.setSelection(3, 6);
      setNativeInputValue(inputNode, 'aaaaaa___ ____ ____');
      setInputSelection(inputNode, 6, 0);
      fireInputEvent(inputNode);
      expect(inputNode.value).to.equal('aaaa aa__ ____ ____');

      input.setSelection(3, 6);
      setNativeInputValue(inputNode, 'aaaaxa__ ____ ____');
      setInputSelection(inputNode, 5, 0);
      fireInputEvent(inputNode);
      expect(inputNode.value).to.equal('aaaa xa__ ____ ____');
      expect(input.getCursorPosition()).to.equal(6);
    }));

  it('should format value in onChange (without maskChar)', createInput(
    <Input mask="**** **** **** ****" maskChar={null} />, (input, inputNode) => {
      inputNode.focus();
      expect(inputNode.value).to.equal('');

      setInputSelection(inputNode, 0, 0);
      setNativeInputValue(inputNode, 'aaa');
      setInputSelection(inputNode, 3, 0);
      fireInputEvent(inputNode);
      expect(inputNode.value).to.equal('aaa');
      expect(input.getCursorPosition()).to.equal(3);

      setNativeInputValue(inputNode, 'aaaaa');
      setInputSelection(inputNode, 5, 0);
      fireInputEvent(inputNode);
      expect(inputNode.value).to.equal('aaaa a');
      expect(input.getCursorPosition()).to.equal(6);

      setNativeInputValue(inputNode, 'aaaa afgh ijkl mnop');
      setInputSelection(inputNode, 19, 0);
      fireInputEvent(inputNode);
      expect(inputNode.value).to.equal('aaaa afgh ijkl mnop');
      expect(input.getCursorPosition()).to.equal(19);

      setNativeInputValue(inputNode, 'aaaa afgh ijkl mnopq');
      setInputSelection(inputNode, 20, 0);
      fireInputEvent(inputNode);
      expect(inputNode.value).to.equal('aaaa afgh ijkl mnop');
      expect(input.getCursorPosition()).to.equal(19);
    }));

  it('should handle entered characters (with maskChar)', createInput(
    <Input mask="+7 (*a9) 999 99 99" />, (input, inputNode) => {
      inputNode.focus();

      input.setCursorPosition(0);
      simulateInputKeyPress(input, '+');
      expect(inputNode.value).to.equal('+7 (___) ___ __ __');

      input.setCursorPosition(0);
      simulateInputKeyPress(input, '7');
      expect(inputNode.value).to.equal('+7 (___) ___ __ __');

      input.setCursorPosition(0);
      simulateInputKeyPress(input, '8');
      expect(inputNode.value).to.equal('+7 (8__) ___ __ __');

      input.setCursorPosition(0);
      simulateInputKeyPress(input, 'E');
      expect(inputNode.value).to.equal('+7 (E__) ___ __ __');

      simulateInputKeyPress(input, '6');
      expect(inputNode.value).to.equal('+7 (E__) ___ __ __');

      simulateInputKeyPress(input, 'x');
      expect(inputNode.value).to.equal('+7 (Ex_) ___ __ __');
    }));

  it('should handle entered characters (without maskChar)', createInput(
    <Input mask="+7 (999) 999 99 99" defaultValue="+7 (111) 123 45 6" maskChar={null} />, (input, inputNode) => {
      inputNode.focus();

      setInputSelection(inputNode, 4, 0);
      simulateInputKeyPress(input, 'E');
      expect(inputNode.value).to.equal('+7 (111) 123 45 6');

      input.setSelection(4, 7);
      simulateInputKeyPress(input, '0');
      expect(inputNode.value).to.equal('+7 (012) 345 6');

      setInputSelection(inputNode, 14, 0);
      simulateInputKeyPress(input, '7');
      simulateInputKeyPress(input, '8');
      simulateInputKeyPress(input, '9');
      simulateInputKeyPress(input, '4');
      expect(inputNode.value).to.equal('+7 (012) 345 67 89');

      setNativeInputValue(inputNode, '+7 (');
      setInputSelection(inputNode, 4, 0);
      fireInputEvent(inputNode);
      setInputSelection(inputNode, 0, 0);
      simulateInputKeyPress(input, '+');
      expect(inputNode.value).to.equal('+7 (');
    }));

  it('should adjust cursor position on input (with maskChar)', createInput(
    <Input mask="(999)" defaultValue="11" />, (input, inputNode) => {
      inputNode.focus();

      setInputSelection(inputNode, 3, 0);
      simulateInputKeyPress(input, 'x');
      expect(input.getCursorPosition()).to.equal(3);

      simulateInputKeyPress(input, '1');
      expect(input.getCursorPosition()).to.equal(4);

      setInputSelection(inputNode, 0, 4);
      simulateInputBackspacePress(input);
      setInputSelection(inputNode, 2, 0);
      simulateInputKeyPress(input, 'x');
      expect(input.getCursorPosition()).to.equal(2);
    }));

  it('should handle single character removal with Backspace (with maskChar)', createInput(
    <Input mask="+7 (999) 999 99 99" defaultValue="74953156454" />, (input, inputNode) => {
      inputNode.focus();

      input.setCursorPosition(10);
      simulateInputBackspacePress(input);
      expect(inputNode.value).to.equal('+7 (495) _15 64 54');

      simulateInputBackspacePress(input);
      expect(inputNode.value).to.equal('+7 (49_) _15 64 54');
    }));

  it('should handle single character removal with Backspace (without maskChar)', createInput(
    <Input mask="+7 (999) 999 99 99" defaultValue="74953156454" maskChar={null} />, (input, inputNode) => {
      inputNode.focus();

      input.setCursorPosition(10);
      simulateInputBackspacePress(input);
      expect(inputNode.value).to.equal('+7 (495) 156 45 4');

      setNativeInputValue(inputNode, '+7 (');
      setInputSelection(inputNode, 4, 0);
      fireInputEvent(inputNode);
      expect(inputNode.value).to.equal('+7 (');

      setNativeInputValue(inputNode, '+7 ');
      setInputSelection(inputNode, 3, 0);
      fireInputEvent(inputNode);
      expect(inputNode.value).to.equal('+7 (');
    }));

  it('should adjust cursor position on single character removal with Backspace (with maskChar)', createInput(
    <Input mask="+7 (999) 999 99 99" defaultValue="74953156454" />, (input, inputNode) => {
      inputNode.focus();

      input.setCursorPosition(10);
      simulateInputBackspacePress(input);
      expect(input.getCursorPosition()).to.equal(9);

      simulateInputBackspacePress(input);
      expect(input.getCursorPosition()).to.equal(6);

      input.setCursorPosition(4);
      simulateInputBackspacePress(input);
      expect(input.getCursorPosition()).to.equal(4);
    }));

  it('should adjust cursor position on single character removal with Backspace (without maskChar)', createInput(
    <Input mask="+7 (999) 999 99 99" defaultValue="749531564" maskChar={null} />, (input, inputNode) => {
      inputNode.focus();

      input.setCursorPosition(16);
      simulateInputBackspacePress(input);
      expect(input.getCursorPosition()).to.equal(14);
    }));

  it('should handle multiple characters removal with Backspace (with maskChar)', createInput(
    <Input mask="+7 (999) 999 99 99" defaultValue="74953156454" />, (input, inputNode) => {
      inputNode.focus();

      input.setSelection(1, 10);
      simulateInputBackspacePress(input);
      expect(inputNode.value).to.equal('+7 (___) _15 64 54');
    }));

  it('should handle multiple characters removal with Backspace (without maskChar)', createInput(
    <Input mask="+7 (999) 999 99 99" defaultValue="74953156454" maskChar={null} />, (input, inputNode) => {
      inputNode.focus();

      input.setSelection(1, 10);
      simulateInputBackspacePress(input);
      expect(inputNode.value).to.equal('+7 (156) 454 ');
    }));

  it('should adjust cursor position on multiple characters removal with Backspace (with maskChar)', createInput(
    <Input mask="+7 (999) 999 99 99" defaultValue="74953156454" />, (input, inputNode) => {
      inputNode.focus();

      input.setSelection(1, 10);
      simulateInputBackspacePress(input);
      expect(input.getCursorPosition()).to.equal(4);
    }));

  it('should handle single character removal with Backspace on mask with escaped characters (without maskChar)', createInput(
    <Input mask="+4\9 99 9\99 99" defaultValue="+49 12 394" maskChar={null} />, (input, inputNode) => {
      inputNode.focus();

      input.setCursorPosition(10);
      simulateInputBackspacePress(input);
      expect(inputNode.value).to.equal('+49 12 39');

      input.setCursorPosition(9);
      simulateInputBackspacePress(input);
      expect(inputNode.value).to.equal('+49 12 ');

      inputNode.focus();
      setNativeInputValue(inputNode, '+49 12 39');
      fireInputEvent(inputNode);
      input.setCursorPosition(6);
      simulateInputBackspacePress(input);
      expect(inputNode.value).to.equal('+49 13 ');
    }));

  it('should adjust cursor position on single character removal with Backspace on mask with escaped characters (without maskChar)', createInput(
    <Input mask="+4\9 99 9\99 99" defaultValue="+49 12 394" maskChar={null} />, (input, inputNode) => {
      inputNode.focus();

      input.setCursorPosition(10);
      simulateInputBackspacePress(input);
      expect(input.getCursorPosition()).to.equal(9);

      input.setCursorPosition(9);
      simulateInputBackspacePress(input);
      expect(input.getCursorPosition()).to.equal(7);

      inputNode.focus();
      setNativeInputValue(inputNode, '+49 12 39');
      fireInputEvent(inputNode);
      input.setCursorPosition(6);
      simulateInputBackspacePress(input);
      expect(input.getCursorPosition()).to.equal(5);
    }));

  it('should handle multiple characters removal with Backspace on mask with escaped characters (without maskChar)', createInput(
    <Input mask="+4\9 99 9\99 99" defaultValue="+49 12 394" maskChar={null} />, (input, inputNode) => {
      inputNode.focus();

      input.setSelection(4, 6);
      simulateInputBackspacePress(input);
      expect(inputNode.value).to.equal('+49 34 ');

      setNativeInputValue(inputNode, '+49 12 394 5');
      fireInputEvent(inputNode);
      input.setSelection(4, 6);
      simulateInputBackspacePress(input);
      expect(inputNode.value).to.equal('+49 34 59');
    }));

  it('should adjust cursor position on multiple characters removal with Backspace on mask with escaped characters (without maskChar)', createInput(
    <Input mask="+4\9 99 9\99 99" defaultValue="+49 12 394" maskChar={null} />, (input, inputNode) => {
      inputNode.focus();

      input.setSelection(4, 6);
      simulateInputBackspacePress(input);
      expect(input.getCursorPosition()).to.equal(4);

      setNativeInputValue(inputNode, '+49 12 394 5');
      fireInputEvent(inputNode);
      input.setSelection(4, 6);
      simulateInputBackspacePress(input);
      expect(input.getCursorPosition()).to.equal(4);
    }));

  it('should handle single character removal with Delete (with maskChar)', createInput(
    <Input mask="+7 (999) 999 99 99" defaultValue="74953156454" />, (input, inputNode) => {
      inputNode.focus();

      input.setCursorPosition(0);
      simulateInputDeletePress(input);
      expect(inputNode.value).to.equal('+7 (_95) 315 64 54');

      input.setCursorPosition(7);
      simulateInputDeletePress(input);
      expect(inputNode.value).to.equal('+7 (_95) _15 64 54');

      input.setCursorPosition(11);
      simulateInputDeletePress(input);
      expect(inputNode.value).to.equal('+7 (_95) _1_ 64 54');
    }));

  it('should adjust cursor position on single character removal with Delete (with maskChar)', createInput(
    <Input mask="+7 (999) 999 99 99" defaultValue="74953156454" />, (input, inputNode) => {
      inputNode.focus();

      input.setCursorPosition(0);
      simulateInputDeletePress(input);
      expect(input.getCursorPosition()).to.equal(4);

      input.setCursorPosition(7);
      simulateInputDeletePress(input);
      expect(input.getCursorPosition()).to.equal(9);

      input.setCursorPosition(11);
      simulateInputDeletePress(input);
      expect(input.getCursorPosition()).to.equal(11);
    }));

  it('should handle multiple characters removal with Delete (with maskChar)', createInput(
    <Input mask="+7 (999) 999 99 99" defaultValue="74953156454" />, (input, inputNode) => {
      inputNode.focus();

      input.setSelection(1, 10);
      simulateInputDeletePress(input);
      expect(inputNode.value).to.equal('+7 (___) _15 64 54');
    }));

  it('should handle single character removal with Delete on mask with escaped characters (without maskChar)', createInput(
    <Input mask="+4\9 99 9\99 99" defaultValue="+49 12 394" maskChar={null} />, (input, inputNode) => {
      inputNode.focus();

      input.setCursorPosition(9);
      simulateInputDeletePress(input);
      expect(inputNode.value).to.equal('+49 12 39');

      input.setCursorPosition(7);
      simulateInputDeletePress(input);
      expect(inputNode.value).to.equal('+49 12 ');

      inputNode.focus();
      setNativeInputValue(inputNode, '+49 12 39');
      fireInputEvent(inputNode);
      input.setCursorPosition(5);
      simulateInputDeletePress(input);
      expect(inputNode.value).to.equal('+49 13 ');
    }));

  it('should adjust cursor position on single character removal with Delete on mask with escaped characters (without maskChar)', createInput(
    <Input mask="+4\9 99 9\99 99" defaultValue="+49 12 394" maskChar={null} />, (input, inputNode) => {
      inputNode.focus();

      input.setCursorPosition(9);
      simulateInputDeletePress(input);
      expect(input.getCursorPosition()).to.equal(9);

      input.setCursorPosition(7);
      simulateInputDeletePress(input);
      expect(input.getCursorPosition()).to.equal(7);

      inputNode.focus();
      setNativeInputValue(inputNode, '+49 12 39');
      fireInputEvent(inputNode);
      input.setCursorPosition(5);
      simulateInputDeletePress(input);
      expect(input.getCursorPosition()).to.equal(5);
    }));

  it('should handle multiple characters removal with Delete on mask with escaped characters (without maskChar)', createInput(
    <Input mask="+4\9 99 9\99 99" defaultValue="+49 12 394" maskChar={null} />, (input, inputNode) => {
      inputNode.focus();

      input.setSelection(4, 6);
      simulateInputDeletePress(input);
      expect(inputNode.value).to.equal('+49 34 ');

      setNativeInputValue(inputNode, '+49 12 394 5');
      fireInputEvent(inputNode);
      input.setSelection(4, 6);
      simulateInputDeletePress(input);
      expect(inputNode.value).to.equal('+49 34 59');
    }));

  it('should adjust cursor position on multiple characters removal with Delete on mask with escaped characters (without maskChar)', createInput(
    <Input mask="+4\9 99 9\99 99" defaultValue="+49 12 394" maskChar={null} />, (input, inputNode) => {
      inputNode.focus();

      input.setSelection(4, 6);
      simulateInputDeletePress(input);
      expect(input.getCursorPosition()).to.equal(4);

      setNativeInputValue(inputNode, '+49 12 394 5');
      fireInputEvent(inputNode);
      input.setSelection(4, 6);
      simulateInputDeletePress(input);
      expect(input.getCursorPosition()).to.equal(4);
    }));

  it('should handle mask change', createInput(
    <Input mask="9999-9999-9999-9999" defaultValue="34781226917" />, (input, inputNode) => {
      setInputProps(input, { mask: '9999-999999-99999' });
      expect(inputNode.value).to.equal('3478-122691-7____');

      setInputProps(input, { mask: '9-9-9-9' });
      expect(inputNode.value).to.equal('3-4-7-8');

      setInputProps(input, { mask: null });
      expect(inputNode.value).to.equal('3-4-7-8');

      setNativeInputValue(inputNode, '0-1-2-3');

      setInputProps(input, { mask: '9999' });
      expect(inputNode.value).to.equal('0123');
    }));

  it('should handle mask change with on controlled input', createInput(
    <Input mask="9999-9999-9999-9999" value="38781226917" />, (input, inputNode) => {
      setInputProps(input, {
        onChange: () => {
          setInputProps(input, {
            mask: '9999-999999-99999',
            value: '3478-1226-917_-____'
          });
        }
      });

      inputNode.focus();

      expect(inputNode.value).to.equal('3878-1226-917_-____');

      setInputSelection(inputNode, 1, 0);
      simulateInputKeyPress(input, '4');
      fireInputEvent(inputNode);

      expect(inputNode.value).to.equal('3478-122691-7____');
    }));

  it('should handle string paste (with maskChar)', createInput(
    <Input mask="9999-9999-9999-9999" defaultValue="____-____-____-6543" />, (input, inputNode) => {
      inputNode.focus();

      setInputSelection(inputNode, 3, 15);
      simulateInputPaste(input, '34781226917');
      expect(inputNode.value).to.equal('___3-4781-2269-17_3');

      setInputSelection(inputNode, 3, 0);
      simulateInputPaste(input, '3-__81-2_6917');
      expect(inputNode.value).to.equal('___3-__81-2_69-17_3');

      setInputSelection(inputNode, 0, 3);
      simulateInputPaste(input, ' 333');
      expect(inputNode.value).to.equal('3333-__81-2_69-17_3');
    }));

  it('should adjust cursor position on string paste (with maskChar)', createInput(
    <Input mask="9999-9999-9999-9999" defaultValue="____-____-____-6543" />, (input, inputNode) => {
      inputNode.focus();

      setInputSelection(inputNode, 3, 15);
      simulateInputPaste(input, '478122691');
      expect(input.getCursorPosition()).to.equal(15);

      setInputSelection(inputNode, 3, 0);
      simulateInputPaste(input, '3-__81-2_6917');
      expect(input.getCursorPosition()).to.equal(17);
    }));

  it('should handle string paste (without maskChar)', createInput(
    <Input mask="9999-9999-9999-9999" defaultValue="9999-9999-9999-9999" maskChar={null} />, (input, inputNode) => {
      inputNode.focus();

      setInputSelection(inputNode, 0, 19);
      simulateInputPaste(input, '34781226917');
      expect(inputNode.value).to.equal('3478-1226-917');

      setInputSelection(inputNode, 1, 0);
      simulateInputPaste(input, '12345');
      expect(inputNode.value).to.equal('3123-4547-8122-6917');

      setInputSelection(inputNode, 1, 0);
      simulateInputPaste(input, '4321');
      expect(inputNode.value).to.equal('3432-1547-8122-6917');

      setInputProps(input, {
        value: '',
        onChange: (event) => {
          setInputProps(input, {
            value: event.target.value
          });
        }
      });

      simulateInputPaste(input, '123');
      expect(inputNode.value).to.equal('123');
    }));

  it('should handle string paste at position of permanent character (with maskChar)', createInput(
    <Input mask="9999-9999-9999" maskChar=" " />, (input, inputNode) => {
      inputNode.focus();

      simulateInputPaste(input, '1111 1111 1111');
      expect(inputNode.value).to.equal('1111-1111-1111');
    }));

  it('should handle formatChars property', createInput(
    <Input mask="11-11" defaultValue="1234" formatChars={{ '1': '[1-3]' }} />, (input, inputNode) => {
      expect(inputNode.value).to.equal('12-3_');
    }));

  it('should keep placeholder on rerender on empty input with alwaysShowMask', createInput(
    <Input mask="99-99" value="" alwaysShowMask />, (input, inputNode) => {
      setInputProps(input, { value: '' });

      expect(inputNode.value).to.equal('__-__');
    }));

  it('should ignore null formatChars', createInput(
    <Input mask="99-99" formatChars={null} alwaysShowMask />, (input, inputNode) => {
      expect(inputNode.value).to.equal('__-__');
    }));

  it('should show empty value when input switches from uncontrolled to controlled', createInput(
    <Input mask="+7 (*a9) 999 99 99" />, (input, inputNode) => {
      setInputProps(input, { value: '+7 (___) ___ __ __' });
      expect(inputNode.value).to.equal('+7 (___) ___ __ __');
    }));

  it('shouldn\'t affect value if mask is empty', createInput(
    <Input value="12345" />, (input, inputNode) => {
      expect(inputNode.value).to.equal('12345');

      setInputProps(input, {
        value: '54321'
      });
      expect(inputNode.value).to.equal('54321');
    }));

  it('should show next permanent character when maskChar is null', createInput(
    <Input mask="99/99/9999" value="01" maskChar={null} />, (input, inputNode) => {
      expect(inputNode.value).to.equal('01/');
    }));

  it('should show all next consecutive permanent characters when maskChar is null', createInput(
    <Input mask="99---99" value="01" maskChar={null} />, (input, inputNode) => {
      expect(inputNode.value).to.equal('01---');
    }));

  it('should show trailing permanent character when maskChar is null', createInput(
    <Input mask="99%" value="10" maskChar={null} />, (input, inputNode) => {
      expect(inputNode.value).to.equal('10%');
    }));

  it('should pass input DOM node to inputRef function', () => {
    let inputRef;
    return createInput(
      <Input inputRef={ref => inputRef = ref} />, (input, inputNode) => {
        expect(inputRef).to.equal(inputNode);
      })();
  });

  it('should allow to modify value with beforeMaskedValueChange', (() => {
    const beforeMaskedValueChange = (newState, oldState, userInput, options, inputInstance) => {
      let { value } = newState;
      let selection = newState.selection;
      let cursorPosition = selection ? selection.start : null;
      if (value.endsWith('-') && userInput !== '-' && (!inputInstance || !inputInstance.props.value.endsWith('-'))) {
        if (cursorPosition === value.length) {
          cursorPosition--;
          selection = { start: cursorPosition, end: cursorPosition };
        }
        value = value.slice(0, -1);
      }

      return {
        value,
        selection
      };
    };

    return createInput(
      <Input mask="99999-9999" maskChar={null} value="12345" beforeMaskedValueChange={beforeMaskedValueChange} />, (input, inputNode) => {
        expect(inputNode.value).to.equal('12345');

        setInputProps(input, {
          onChange: (event) => {
            setInputProps(input, {
              value: event.target.value
            });
          },
          beforeMaskedValueChange: (newState, oldState, userInput, options) => {
            return beforeMaskedValueChange(newState, oldState, userInput, options, input);
          }
        });

        inputNode.focus();

        setInputProps(input, { value: '12345' });
        expect(inputNode.value).to.equal('12345');

        input.setCursorPosition(5);

        simulateInputKeyPress(input, '-');
        expect(inputNode.value).to.equal('12345-');
      });
  })());

  it('shouldn\'t modify value on entering non-allowed character', createInput(
    <Input mask="9999" defaultValue="1234" />, (input, inputNode) => {
      inputNode.focus();

      input.setCursorPosition(0);
      simulateInputKeyPress(input, 'a');

      expect(inputNode.value).to.equal('1234');
      expect(input.getCursorPosition()).to.equal(0);

      input.setSelection(0, 1);
      simulateInputKeyPress(input, 'a');

      expect(inputNode.value).to.equal('1234');

      input.setSelection(1, 4);
      simulateInputKeyPress(input, 'a');

      expect(inputNode.value).to.equal('1234');
    }));

  it('should handle autofill', createInput(
    <Input mask="9999-9999" defaultValue="123" maskChar={null} />, (input, inputNode) => {
      input.isInputAutofilled = () => true;

      inputNode.focus();

      setNativeInputValue(inputNode, '12345678');
      setInputSelection(inputNode, 8, 0);
      fireInputEvent(inputNode);

      expect(inputNode.value).to.equal('1234-5678');
    }));

  it('should handle transition between masked and non-masked state', createInput(
    <Input />, (input, inputNode) => {
      setInputProps(input, {
        value: '',
        onChange: (event) => {
          setInputProps(input, {
            value: event.target.value,
            mask: event.target.value ? '+7 999 999 99 99' : null
          });
        }
      });

      inputNode.focus();

      expect(input.getCursorPosition()).to.equal(0);

      simulateInputKeyPress(input, '1');
      expect(inputNode.value).to.equal('+7 1__ ___ __ __');
      expect(input.getCursorPosition()).to.equal(4);

      simulateInputBackspacePress(input);
      inputNode.blur();

      expect(inputNode.value).to.equal('');

      inputNode.focus();

      expect(input.getCursorPosition()).to.equal(0);

      simulateInputKeyPress(input, '1');
      expect(inputNode.value).to.equal('+7 1__ ___ __ __');
      expect(input.getCursorPosition()).to.equal(4);
    }));

  it('should handle regular component as children', createInput(
    <Input mask="+7 (999) 999 99 99">{(props) => <TestInputComponent {...props} />}</Input>, (input, inputNode) => {
      inputNode.focus();

      expect(input.getCursorPosition()).to.equal(4);

      simulateInputKeyPress(input, '1');
      expect(inputNode.value).to.equal('+7 (1__) ___ __ __');
      expect(input.getCursorPosition()).to.equal(5);
    }));

  it('should handle functional component as children', createInput(
    <Input mask="+7 (999) 999 99 99">{(props) => <TestFunctionalInputComponent {...props} />}</Input>, (input, inputNode) => {
      inputNode.focus();

      expect(input.getCursorPosition()).to.equal(4);

      simulateInputKeyPress(input, '1');
      expect(inputNode.value).to.equal('+7 (1__) ___ __ __');
      expect(input.getCursorPosition()).to.equal(5);
    }));


  it('should handle children change', createInput(
    <Input mask="+7 (999) 999 99 99" />, (input, inputNode) => {
      setInputProps(input, {
        value: '',
        onChange: (event) => {
          setInputProps(input, {
            value: event.target.value
          });
        },
        children: (props) => <TestInputComponent {...props} />
      });
      inputNode = getInputDOMNode(input);

      inputNode.focus();

      expect(input.getCursorPosition()).to.equal(4);

      simulateInputKeyPress(input, '1');
      expect(inputNode.value).to.equal('+7 (1__) ___ __ __');
      expect(input.getCursorPosition()).to.equal(5);

      setInputProps(input, {
        children: (props) => <TestFunctionalInputComponent {...props} />,
        value: '22'
      });
      inputNode = getInputDOMNode(input);

      expect(inputNode.value).to.equal('+7 (22_) ___ __ __');

      setInputProps(input, {
        children: null
      });
      inputNode = getInputDOMNode(input);

      expect(inputNode.value).to.equal('+7 (22_) ___ __ __');
    }));


  it('should handle change event without focus', createInput(
    <Input mask="+7 (999) 999 99 99" maskChar={null} />, (input, inputNode) => {
      setNativeInputValue(inputNode, '+71234567890');
      fireInputEvent(inputNode);
      expect(inputNode.value).to.equal('+7 (123) 456 78 90');
    }));


  it('shouldn\'t move cursor on delayed value change', createInput(
    <Input mask="+7 (999) 999 99 99" maskChar={null} />, (input, inputNode) => {
      setInputProps(input, {
        value: '+7 (9',
        onChange: (event) => {
          setInputProps(input, {
            value: event.target.value
          });
        }
      });

      inputNode.focus();

      expect(input.getCursorPosition()).to.equal(5);

      return new Promise((resolve) => {
        setTimeout(() => {
          setInputProps(input, {
            value: '+7 (99'
          });

          expect(input.getCursorPosition()).to.equal(5);
          resolve();
        }, 100);
      });
    }));
});

/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDOMInput
 */

'use strict';

var DOMPropertyOperations = require('DOMPropertyOperations');
var ReactControlledValuePropTypes = require('ReactControlledValuePropTypes');
var ReactDOMComponentTree = require('ReactDOMComponentTree');

var invariant = require('fbjs/lib/invariant');
var warning = require('fbjs/lib/warning');

if (__DEV__) {
  var {
    getStackAddendumByID,
  } = require('ReactGlobalSharedState').ReactComponentTreeHook;
}

var didWarnValueDefaultValue = false;
var didWarnCheckedDefaultChecked = false;
var didWarnControlledToUncontrolled = false;
var didWarnUncontrolledToControlled = false;

function isControlled(props) {
  var usesChecked = props.type === 'checkbox' || props.type === 'radio';
  return usesChecked ? props.checked != null : props.value != null;
}

/**
 * Implements an <input> host component that allows setting these optional
 * props: `checked`, `value`, `defaultChecked`, and `defaultValue`.
 *
 * If `checked` or `value` are not supplied (or null/undefined), user actions
 * that affect the checked state or value will trigger updates to the element.
 *
 * If they are supplied (and not null/undefined), the rendered element will not
 * trigger updates to the element. Instead, the props must change in order for
 * the rendered element to be updated.
 *
 * The rendered element will be initialized as unchecked (or `defaultChecked`)
 * with an empty value (or `defaultValue`).
 *
 * @see http://www.w3.org/TR/2012/WD-html5-20121025/the-input-element.html
 */
var ReactDOMInput = {
  getHostProps: function(inst, props) {
    var value = props.value;
    var checked = props.checked;

    var hostProps = Object.assign(
      {
        // Make sure we set .type before any other properties (setting .value
        // before .type means .value is lost in IE11 and below)
        type: undefined,
        // Make sure we set .step before .value (setting .value before .step
        // means .value is rounded on mount, based upon step precision)
        step: undefined,
        // Make sure we set .min & .max before .value (to ensure proper order
        // in corner cases such as min or max deriving from value, e.g. Issue #7170)
        min: undefined,
        max: undefined,
      },
      props,
      {
        defaultChecked: undefined,
        defaultValue: undefined,
        value: value != null ? value : inst._wrapperState.initialValue,
        checked: checked != null ? checked : inst._wrapperState.initialChecked,
      },
    );

    return hostProps;
  },

  mountWrapper: function(inst, props) {
    if (__DEV__) {
      var owner = inst._currentElement._owner;
      ReactControlledValuePropTypes.checkPropTypes('input', props, () =>
        getStackAddendumByID(inst._debugID),
      );

      if (
        props.checked !== undefined &&
        props.defaultChecked !== undefined &&
        !didWarnCheckedDefaultChecked
      ) {
        warning(
          false,
          '%s contains an input of type %s with both checked and defaultChecked props. ' +
            'Input elements must be either controlled or uncontrolled ' +
            '(specify either the checked prop, or the defaultChecked prop, but not ' +
            'both). Decide between using a controlled or uncontrolled input ' +
            'element and remove one of these props. More info: ' +
            'https://fb.me/react-controlled-components',
          (owner && owner.getName()) || 'A component',
          props.type,
        );
        didWarnCheckedDefaultChecked = true;
      }
      if (
        props.value !== undefined &&
        props.defaultValue !== undefined &&
        !didWarnValueDefaultValue
      ) {
        warning(
          false,
          '%s contains an input of type %s with both value and defaultValue props. ' +
            'Input elements must be either controlled or uncontrolled ' +
            '(specify either the value prop, or the defaultValue prop, but not ' +
            'both). Decide between using a controlled or uncontrolled input ' +
            'element and remove one of these props. More info: ' +
            'https://fb.me/react-controlled-components',
          (owner && owner.getName()) || 'A component',
          props.type,
        );
        didWarnValueDefaultValue = true;
      }
    }

    var defaultValue = props.defaultValue;
    inst._wrapperState = {
      initialChecked: props.checked != null
        ? props.checked
        : props.defaultChecked,
      initialValue: props.value != null ? props.value : defaultValue,
      listeners: null,
      controlled: isControlled(props),
    };
  },

  updateWrapper: function(inst) {
    var props = inst._currentElement.props;

    if (__DEV__) {
      var controlled = isControlled(props);

      if (
        !inst._wrapperState.controlled &&
        controlled &&
        !didWarnUncontrolledToControlled
      ) {
        warning(
          false,
          'A component is changing an uncontrolled input of type %s to be controlled. ' +
            'Input elements should not switch from uncontrolled to controlled (or vice versa). ' +
            'Decide between using a controlled or uncontrolled input ' +
            'element for the lifetime of the component. More info: https://fb.me/react-controlled-components%s',
          props.type,
          getStackAddendumByID(inst._debugID),
        );
        didWarnUncontrolledToControlled = true;
      }
      if (
        inst._wrapperState.controlled &&
        !controlled &&
        !didWarnControlledToUncontrolled
      ) {
        warning(
          false,
          'A component is changing a controlled input of type %s to be uncontrolled. ' +
            'Input elements should not switch from controlled to uncontrolled (or vice versa). ' +
            'Decide between using a controlled or uncontrolled input ' +
            'element for the lifetime of the component. More info: https://fb.me/react-controlled-components%s',
          props.type,
          getStackAddendumByID(inst._debugID),
        );
        didWarnControlledToUncontrolled = true;
      }
    }

    var checked = props.checked;
    if (checked != null) {
      DOMPropertyOperations.setValueForProperty(
        ReactDOMComponentTree.getNodeFromInstance(inst),
        'checked',
        checked || false,
      );
    }

    var node = ReactDOMComponentTree.getNodeFromInstance(inst);
    var value = props.value;
    if (value != null) {
      if (value === 0 && node.value === '') {
        node.value = '0';
        // Note: IE9 reports a number inputs as 'text', so check props instead.
      } else if (props.type === 'number') {
        // Simulate `input.valueAsNumber`. IE9 does not support it
        var valueAsNumber = parseFloat(node.value, 10) || 0;

        if (
          // eslint-disable-next-line
          value != valueAsNumber ||
          // eslint-disable-next-line
          (value == valueAsNumber && node.value != value)
        ) {
          // Cast `value` to a string to ensure the value is set correctly. While
          // browsers typically do this as necessary, jsdom doesn't.
          node.value = '' + value;
        }
      } else if (node.value !== '' + value) {
        // Cast `value` to a string to ensure the value is set correctly. While
        // browsers typically do this as necessary, jsdom doesn't.
        node.value = '' + value;
      }
    } else {
      if (props.value == null && props.defaultValue != null) {
        // In Chrome, assigning defaultValue to certain input types triggers input validation.
        // For number inputs, the display value loses trailing decimal points. For email inputs,
        // Chrome raises "The specified value <x> is not a valid email address".
        //
        // Here we check to see if the defaultValue has actually changed, avoiding these problems
        // when the user is inputting text
        //
        // https://github.com/facebook/react/issues/7253
        if (node.defaultValue !== '' + props.defaultValue) {
          node.defaultValue = '' + props.defaultValue;
        }
      }
      if (props.checked == null && props.defaultChecked != null) {
        node.defaultChecked = !!props.defaultChecked;
      }
    }
  },

  postMountWrapper: function(inst) {
    var props = inst._currentElement.props;

    // This is in postMount because we need access to the DOM node, which is not
    // available until after the component has mounted.
    var node = ReactDOMComponentTree.getNodeFromInstance(inst);

    // Detach value from defaultValue. We won't do anything if we're working on
    // submit or reset inputs as those values & defaultValues are linked. They
    // are not resetable nodes so this operation doesn't matter and actually
    // removes browser-default values (eg "Submit Query") when no value is
    // provided.

    switch (props.type) {
      case 'submit':
      case 'reset':
        break;
      case 'color':
      case 'date':
      case 'datetime':
      case 'datetime-local':
      case 'month':
      case 'time':
      case 'week':
        // This fixes the no-show issue on iOS Safari and Android Chrome:
        // https://github.com/facebook/react/issues/7233
        node.value = '';
        node.value = node.defaultValue;
        break;
      default:
        node.value = node.value;
        break;
    }

    // Normally, we'd just do `node.checked = node.checked` upon initial mount, less this bug
    // this is needed to work around a chrome bug where setting defaultChecked
    // will sometimes influence the value of checked (even after detachment).
    // Reference: https://bugs.chromium.org/p/chromium/issues/detail?id=608416
    // We need to temporarily unset name to avoid disrupting radio button groups.
    var name = node.name;
    if (name !== '') {
      node.name = '';
    }
    node.defaultChecked = !node.defaultChecked;
    node.defaultChecked = !node.defaultChecked;
    if (name !== '') {
      node.name = name;
    }
  },

  restoreControlledState: function(inst) {
    if (inst._rootNodeID) {
      // DOM component is still mounted; update
      ReactDOMInput.updateWrapper(inst);
    }
    var props = inst._currentElement.props;
    updateNamedCousins(inst, props);
  },
};

function updateNamedCousins(thisInstance, props) {
  var name = props.name;
  if (props.type === 'radio' && name != null) {
    var rootNode = ReactDOMComponentTree.getNodeFromInstance(thisInstance);
    var queryRoot = rootNode;

    while (queryRoot.parentNode) {
      queryRoot = queryRoot.parentNode;
    }

    // If `rootNode.form` was non-null, then we could try `form.elements`,
    // but that sometimes behaves strangely in IE8. We could also try using
    // `form.getElementsByName`, but that will only return direct children
    // and won't include inputs that use the HTML5 `form=` attribute. Since
    // the input might not even be in a form. It might not even be in the
    // document. Let's just use the local `querySelectorAll` to ensure we don't
    // miss anything.
    var group = queryRoot.querySelectorAll(
      'input[name=' + JSON.stringify('' + name) + '][type="radio"]',
    );

    for (var i = 0; i < group.length; i++) {
      var otherNode = group[i];
      if (otherNode === rootNode || otherNode.form !== rootNode.form) {
        continue;
      }
      // This will throw if radio buttons rendered by different copies of React
      // and the same name are rendered into the same form (same as #1939).
      // That's probably okay; we don't support it just as we don't support
      // mixing React radio buttons with non-React ones.
      var otherInstance = ReactDOMComponentTree.getInstanceFromNode(otherNode);
      invariant(
        otherInstance,
        'ReactDOMInput: Mixing React and non-React radio inputs with the ' +
          'same `name` is not supported.',
      );
      // If this is a controlled radio button group, forcing the input that
      // was previously checked to update will cause it to be come re-checked
      // as appropriate.
      if (otherInstance._rootNodeID) {
        ReactDOMInput.updateWrapper(otherInstance);
      }
    }
  }
}

module.exports = ReactDOMInput;

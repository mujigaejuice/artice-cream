/** Keyboard shortcut predicates: pure functions plus a jsdom target check. */
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  canAutoFocus, digitChoice, isComposing, isInteractiveTarget, isModalOpen, isPlainEnter, isPrimaryEnter, modifierLabel,
} from "../lib/keyboard";

assert.equal(isComposing({ isComposing: true }), true);
assert.equal(isComposing({ keyCode: 229 }), true);
assert.equal(isComposing({ isComposing: false, keyCode: 13 }), false);

assert.equal(digitChoice("1", 4), 0);
assert.equal(digitChoice("4", 4), 3);
assert.equal(digitChoice("5", 4), null);
assert.equal(digitChoice("5", 5), 4);
assert.equal(digitChoice("0", 4), null);
assert.equal(digitChoice("a", 4), null);
assert.equal(digitChoice("12", 20), null, "only single digits");

const enter = { key: "Enter", metaKey: false, ctrlKey: false, altKey: false, shiftKey: false };
assert.equal(isPlainEnter(enter), true);
assert.equal(isPlainEnter({ ...enter, ctrlKey: true }), false);
assert.equal(isPlainEnter({ ...enter, shiftKey: true }), false);
assert.equal(isPlainEnter({ ...enter, altKey: true }), false);
assert.equal(isPlainEnter({ ...enter, isComposing: true }), false);
assert.equal(isPlainEnter({ ...enter, key: "a" }), false);
assert.equal(isPrimaryEnter({ ...enter, ctrlKey: true }), true);
assert.equal(isPrimaryEnter({ ...enter, metaKey: true }), true);
assert.equal(isPrimaryEnter(enter), false);
assert.equal(isPrimaryEnter({ ...enter, ctrlKey: true, keyCode: 229 }), false);

assert.equal(modifierLabel("MacIntel"), "⌘");
assert.equal(modifierLabel("macOS"), "⌘");
assert.equal(modifierLabel("iPad"), "⌘");
assert.equal(modifierLabel("Win32"), "Ctrl");
assert.equal(modifierLabel("Linux x86_64"), "Ctrl");
assert.equal(modifierLabel(undefined), "Ctrl");

const dom = new JSDOM(`<a id="link" href="/x"><span id="inlink">x</span></a><a id="bare">no href</a>
  <button id="btn">b</button><div role="radio" id="radio"></div><input id="field"><p id="text">t</p>`);
const byId = (id: string) => dom.window.document.getElementById(id);
assert.equal(isInteractiveTarget(byId("link")), true);
assert.equal(isInteractiveTarget(byId("inlink")), true, "inside a link counts");
assert.equal(isInteractiveTarget(byId("bare")), false, "anchor without href is not a link");
assert.equal(isInteractiveTarget(byId("btn")), true);
assert.equal(isInteractiveTarget(byId("radio")), true);
assert.equal(isInteractiveTarget(byId("field")), true);
assert.equal(isInteractiveTarget(byId("text")), false);
assert.equal(isInteractiveTarget(null), false);
assert.equal(isModalOpen(dom.window.document), false);
const modal = dom.window.document.createElement("div");
modal.setAttribute("aria-modal", "true");
dom.window.document.body.append(modal);
assert.equal(isModalOpen(dom.window.document), true, "an open aria-modal dialog pauses page shortcuts");
dom.window.close();

assert.equal(canAutoFocus({ matchMedia: (q: string) => ({ matches: q === "(pointer: fine)" }) }), true);
assert.equal(canAutoFocus({ matchMedia: () => ({ matches: false }) }), false, "touch screens keep focus where it was");
assert.equal(canAutoFocus({}), false, "no matchMedia means no automatic focus");
assert.equal(canAutoFocus(undefined), false);

console.log("Keyboard: IME composition, digit choice, plain/primary Enter, platform label and interactive targets passed.");

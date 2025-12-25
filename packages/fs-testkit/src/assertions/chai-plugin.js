// TODO: Remove after assertions are ready
/* eslint-disable no-unused-vars */
/* eslint-disable jsdoc/reject-any-type */
/* eslint-disable jsdoc/require-returns */

import { Dir } from "../dir.js";
import { File } from "../file.js";
import { Sandbox } from "../sandbox.js";
import { AssertionHarness } from "./assertion-harness.js";

/**
 * @param {unknown} testable
 * @returns {boolean}
 */
function canTestSubject(testable) {
  return (
    testable instanceof Dir ||
    testable instanceof File ||
    testable instanceof Sandbox
  );
}

/**
 * @param {unknown} subjectOrTestArgument
 * @returns {string}
 */
export function nameForSubjectOrTestArgument(subjectOrTestArgument) {
  if (typeof subjectOrTestArgument === "string") {
    return subjectOrTestArgument;
  }

  if (subjectOrTestArgument instanceof Dir) {
    return `directory "${subjectOrTestArgument.name}"`;
  }

  if (subjectOrTestArgument instanceof File) {
    return `file "${subjectOrTestArgument.name}"`;
  }

  if (subjectOrTestArgument instanceof Sandbox) {
    return "sandbox";
  }

  return JSON.stringify(subjectOrTestArgument, null, 2);
}

/**
 * @type {Chai.ChaiPlugin}
 */
export function chaiPlugin(c) {
  const chaiHarness = new AssertionHarness();

  /**
   * @param {keyof typeof chaiHarness} harnessMethod
   * @param {string} verbPhrase
   * @param {(...args: any[]) => void} [s]
   * @returns {(...args: any[]) => void}
   */
  function createAssertFn(harnessMethod, verbPhrase, s) {
    return function (/** @type {any} */ ...args) {
      // @ts-ignore
      const subject = this._obj;
      if (canTestSubject(subject)) {
        const result = chaiHarness[harnessMethod](subject, ...args);
        const resultIsPromise = "then" in result;

        if (resultIsPromise) {
          return result.then((/** @type {{ pass: any; }} */ actualResult) => {
            // @ts-ignore
            this.assert(
              actualResult.pass,
              `expected ${nameForSubjectOrTestArgument(subject)} to ${verbPhrase} ${args.map(nameForSubjectOrTestArgument).join(", ")}`,
              `expected ${nameForSubjectOrTestArgument(subject)} not to ${verbPhrase} ${args.map(nameForSubjectOrTestArgument).join(", ")}`
            );
          });
        }

        // @ts-ignore
        this.assert(
          result.pass,
          `expected ${nameForSubjectOrTestArgument(subject)} to ${verbPhrase} ${args.map(nameForSubjectOrTestArgument).join(", ")}`,
          `expected ${nameForSubjectOrTestArgument(subject)} not to ${verbPhrase} ${args.map(nameForSubjectOrTestArgument).join(", ")}`
        );
      } else {
        if (s) {
          // @ts-ignore
          s.call(this, ...args);
        } else {
          throw new Error(
            `Expected ${harnessMethod} with ${verbPhrase} to be asserted on a sandbox, file or dir object`
          );
        }
      }
    };
  }

  /**
   *
   * @param {string} name
   * @param {keyof typeof chaiHarness} harnessMethod
   * @param {string} verbPhrase
   */
  function overwriteMethod(name, harnessMethod, verbPhrase) {
    c.Assertion.overwriteMethod(name, function () {
      // @ts-ignore
      return function (s) {
        // @ts-ignore
        return createAssertFn(harnessMethod, verbPhrase, s);
      };
    });
  }

  /**
   * @param {string} name
   * @param {keyof typeof chaiHarness} harnessMethod
   * @param {string} verbPhrase
   */
  function overwriteChainable(name, harnessMethod, verbPhrase) {
    c.Assertion.overwriteChainableMethod(
      name,
      function (s) {
        return createAssertFn(harnessMethod, verbPhrase, s);
      },
      // this function is used for when the chainable is used as a property
      // but until this is needed where it's overwriting a chainable where
      // the property portion is used, this will be ignored, eg: (assert(x).includes.five),
      // where `includes` is used in the property chain and not as a method (eg: assert(x).includes(5))
      // @ts-ignore
      function (s) {
        return function () {
          // @ts-ignore
          return s.call(this, ...arguments);
        };
      }
    );
  }

  /**
   * @param {string} name
   * @param {keyof typeof chaiHarness} harnessMethod
   * @param {string} verbPhrase
   */
  function overwriteProperty(name, harnessMethod, verbPhrase) {
    // @ts-ignore
    c.Assertion.overwriteProperty(name, function (s) {
      return createAssertFn(harnessMethod, verbPhrase, s);
    });
  }

  /**
   * @param {string} name
   * @param {keyof typeof chaiHarness} harnessMethod
   * @param {string} verbPhrase
   */
  function addProperty(name, harnessMethod, verbPhrase) {
    return c.Assertion.addProperty(
      name,
      createAssertFn(harnessMethod, verbPhrase)
    );
  }

  /**
   * @param {string} name
   * @param {keyof typeof chaiHarness} harnessMethod
   * @param {string} verbPhrase
   */
  function addMethod(name, harnessMethod, verbPhrase) {
    return c.Assertion.addMethod(
      name,
      createAssertFn(harnessMethod, verbPhrase)
    );
  }

  const includeVariants = ["includes", "include", "contain", "contains"];
  includeVariants.forEach((includeVariant) => {
    overwriteChainable(includeVariant, "toContainFileOrDir", "contain");
  });

  addProperty("existOnFileSystem", "toExist", "exist on filesystem");
}

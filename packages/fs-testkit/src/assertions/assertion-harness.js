// TODO: Remove after assertions are ready
/* eslint-disable jsdoc/reject-any-type */

import { assertDirOrFileToExist } from "./assertion-functions/dir-or-file.js";
import { assertDirToContainFile } from "./assertion-functions/dir.js";
import { assertFileToHaveExactContents } from "./assertion-functions/file.js";

export class AssertionHarness {
  #onFailure;
  #onSuccess;

  /**
   * @param {import("../types.js").AssertionOnFailureFunction} [onFailure]
   * @param {import("../types.js").AssertionOnSuccessFunction} [onSuccess]
   */
  constructor(onFailure, onSuccess) {
    const resultIdentityFn = (
      /** @type {import("../types.js").AssertionResult} */ result
    ) => result;
    this.#onFailure = onFailure ?? resultIdentityFn;
    this.#onSuccess = onSuccess ?? resultIdentityFn;

    this.toContainFileOrDir = proxyResult(
      assertDirToContainFile,
      this.#onFailure,
      this.#onSuccess
    );

    this.toExist = proxyResult(
      assertDirOrFileToExist,
      this.#onFailure,
      this.#onSuccess
    );

    this.toHaveExactContents = proxyResult(
      assertFileToHaveExactContents,
      this.#onFailure,
      this.#onSuccess
    );
  }
}

/**
 * @template Actual
 * @template {unknown[]} Args
 * @param {import("../types.js").AssertionFunction<Actual, Args>} assertion
 * @param {(result: import("../types.js").AssertionFailureResult) => any} onFailure
 * @param {(result: import("../types.js").AssertionSuccessResult) => any} onSuccess
 * @returns {(a: Actual, ...args: Args) => any}
 */
function proxyResult(assertion, onFailure, onSuccess) {
  return function (/** @type {Parameters<typeof assertion>} */ ...args) {
    const [actual, ...rest] = args;

    /**
     * @param {import("../types.js").AssertionResult} result
     * @returns {any}
     */
    const callbackResultFromAssertResult = (result) => {
      if (result.pass) {
        return onSuccess(result);
      } else {
        return onFailure(result);
      }
    };

    const assertionResult = assertion(actual, ...rest);

    // handle cases where the assertion result is a promise
    if ("then" in assertionResult) {
      return assertionResult.then((awaitedResult) => {
        return callbackResultFromAssertResult(awaitedResult);
      });
    }

    return callbackResultFromAssertResult(assertionResult);
  };
}

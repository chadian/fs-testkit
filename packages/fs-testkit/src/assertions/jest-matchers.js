import { AssertionHarness } from "./assertion-harness.js";
import { nameForSubjectOrTestArgument } from "./chai-plugin.js";

const assertionHarness = new AssertionHarness(
  (failureResult) => {
    return {
      ...failureResult,
      message: () => failureResult.message,
    };
  },
  (successResult) => {
    return {
      ...successResult,
      message: () => successResult.message,
    };
  }
);

/**
 * @param {string} harnessMethod
 * @param {string} verbPhrase
 * @returns {jest.CustomMatcher}
 */
function mapAssertionFunctionToJest(harnessMethod, verbPhrase) {
  return function (subject, ...args) {
    const message = this.isNot
      ? `Expected ${nameForSubjectOrTestArgument(subject)} not to ${verbPhrase} ${args.map(nameForSubjectOrTestArgument).join(", ")}`
      : `Expected ${nameForSubjectOrTestArgument(subject)} to ${verbPhrase} ${args.map(nameForSubjectOrTestArgument).join(", ")}`;

    // @ts-ignore
    const result = assertionHarness[harnessMethod](subject, ...args);

    const resultIsPromise = "then" in result;
    if (resultIsPromise) {
      return result.then(
        (/** @type {import("../types.js").AssertionResult}*/ actualResult) => {
          return {
            pass: actualResult.pass,
            message: () => message,
          };
        }
      );
    }

    return {
      pass: result.pass,
      message: () => message,
    };
  };
}

export const toContainFileOrDir = mapAssertionFunctionToJest(
  "toContainFileOrDir",
  "contain"
);

export const toExistOnFileSystem = mapAssertionFunctionToJest(
  "toExist",
  "exist on filesystem"
);

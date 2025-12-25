/**
 * @param {object} object
 * @returns {object}
 */
export function removeUndefinedValues(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined)
  );
}

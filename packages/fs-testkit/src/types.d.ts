import { File } from "./file.js";

export type ScaffoldFileContents = Parameters<File["create"]>[0];
export type ScaffoldFileOptions = Parameters<File["create"]>[1];

export type ScaffoldFile =
  | ScaffoldFileContents
  | [ScaffoldFileContents, ScaffoldFileOptions];

interface ObjectTree<FileRepresentation> {
  [name: string]: ScaffoldDir | FileRepresentation<FileRepresentation>;
}

export type ScaffoldDir<FileRepresentation = ScaffoldFile> =
  ObjectTree<FileRepresentation>;

export type AssertionFunction<Actual, Args> = (
  actual: Actual,
  ...args: Args
) => AssertionResult | Promise<AssertionResult>;
export type AssertionResult = AssertionFailureResult | AssertionSuccessResult;
export type AssertionResultBase = {
  pass: boolean;
  subject: any;
  arguments: any[];
};
export type AssertionFailureResult = AssertionResultBase & {
  pass: false;
  message: string;
};
export type AssertionSuccessResult = AssertionResultBase & {
  pass: true;
  message?: string;
};
export type AssertionOnFailureFunction = (AssertionFailureResult) => any;
export type AssertionOnSuccessFunction = (AssertionSuccessResult) => any;

export type TextChange = "add" | "remove" | "equal";
export type FileChange = "add" | "remove" | "equal" | "modify";

export type DirDiff = Diff<FileChange, string>[];
export type FileDiff = Diff<TextChange, string>[];
export type BlobDiff = Diff<FileChange, string>;

export type Diff<Change extends string, Value extends any> = {
  type: Change;
  value: value;
};

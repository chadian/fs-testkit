# fs-testkit

`fs-testkit` provides testing utilities to write better tests that use the file
system

Features:

- A simple API to quickly scaffold the file system with files and directories,
  handle pathing, and run filesystem operations
- Use snapshots to capture the state of the filesytem and then restore to those
  existing state, or perform a diff between different states
- Extract information in readable formats from the filesystem that make it
  clearer to read and write tests
- Includes typescript types
- Testing library integrations with custom assertions (in development for
  vitest, jest, and chai)

See the [documentation](https://chadian.github.io/fs-testkit/) for features,
examples and API docs.

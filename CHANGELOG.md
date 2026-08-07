# Change Log

All notable changes to the "language-support-for-helium-dsl" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Added

* Added missing keywords to grammar for syntax highlighting:
    * throw
    * try
    * catch
    * finally
    * foreach
* Added missing data types to grammar for syntax highlighting:
    * json
    * jsonarray
* Added multiline strings to grammar for syntax highlighting, and to language
  support.

### Removed
 
* Removed single quotes from grammar. One-line strings only use double-quoutes,
  not single quotes.

## [1.9.0]

### Added

* Code completion (`vscode.CompletionItemProvider`) for Helium Rapid `.mez` files:
    * General: objects, enums, units, validators, file functions, in-scope variables, primitives, platform types, keywords
    * Member access after `.` (object attributes / enum members)
    * Unit-scoped functions after `Unit:`
    * Validators after `@`

## [1.8.0]

### Added

* Rename Symbol (`vscode.RenameProvider`) for Helium Rapid `.mez` files:
    * Renames declarations and references found by the reference provider
    * Validates identifier syntax and reserved words

## [1.7.0]

### Added

* Document symbols (`vscode.DocumentSymbolProvider`) for Helium Rapid `.mez` files:
    * Outline / Go to Symbol in Editor for units, objects, enums, validators, functions, and unit-level variables
    * Nested attributes under objects and enum members under enums

## [1.6.0]

### Added

* Find All References (`vscode.ReferenceProvider`) for Helium Rapid `.mez` files:
    * Workspace-wide references for objects, enums, validators, units, functions, enum members, and attributes
    * File-local references for variables
    * Skips matches inside comments and string literals

## [1.5.0]

### Added

* Go to Definition (`vscode.DefinitionProvider`) for Helium Rapid `.mez` files:
    * Workspace-wide navigation to objects, enums, validators, units, functions, and enum members
    * Object attribute navigation when the receiver type can be inferred from a variable binding or `before`/`after` trigger context

## [1.4.0]

- Syntax Highlighting
- Language Support for:
    - Toggling in-line and block comments.
    - Autoclosing pairs: parentheses, braces, brackets, double quotes.
    - Pairs for surrounding selections: parentheses, braces, brackets, double quotes.

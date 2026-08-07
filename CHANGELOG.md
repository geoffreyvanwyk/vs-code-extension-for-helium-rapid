# Change Log

All notable changes to the "language-support-for-helium-rapid" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [2.0.0] - Preview

First preview release with a TypeScript extension host and language intelligence for Helium Rapid `.mez` files (beyond syntax highlighting and editor language configuration).

### Added

* Marked the extension as Marketplace **Preview** (`"preview": true`).
* Go to Definition across workspace `.mez` files for:
    * Objects, enums, validators, and units
    * Functions and enum members
    * Object attributes when the receiver type is known (e.g. `shop.shopCode`)
* Find All References for the same symbol kinds (file-local for variables); skips matches in comments and strings.
* Document symbols (Outline / Go to Symbol in Editor) for units, objects, enums, validators, functions, and unit-level variables, with attributes nested under objects and members under enums.
* Rename Symbol (F2) across the reference set, with identifier and reserved-word validation.
* Code completion for types, members, validators, keywords, platform types, and in-scope symbols (triggers: `.`, `:`, `@`).
* Signature help for user-defined functions while typing calls (`(`, `,`).
* Grammar and language-configuration improvements, including:
    * Keywords: `throw`, `try`, `catch`, `finally`, `foreach`
    * Types: `json`, `jsonarray`
    * Multiline strings (`/% ... %/`)
    * Embedded SQL highlighting in `sql:query` / `sql:execute` calls

### Removed

* Single-quoted string support from the grammar (one-line strings use double quotes only).

## [1.4.0]

- Syntax Highlighting
- Language Support for:
    - Toggling in-line and block comments.
    - Autoclosing pairs: parentheses, braces, brackets, double quotes.
    - Pairs for surrounding selections: parentheses, braces, brackets, double quotes.

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

## [1.4.0]

- Syntax Highlighting
- Language Support for:
    - Toggling in-line and block comments.
    - Autoclosing pairs: parentheses, braces, brackets, double quotes.
    - Pairs for surrounding selections: parentheses, braces, brackets, double quotes.
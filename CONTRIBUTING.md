# Contributing Guide 

## What's in the folder

This folder contains all of the files necessary for your extension.
* `package.json` - this is the manifest file in which you declare your language support, activation, and the location of the grammar file.
* `src/` - TypeScript extension host code (DefinitionProvider and workspace symbol index). Compile with `npm run compile`.
* `syntaxes/heliumrapid.tmLanguage.json` - this is the TextMate grammar file that is used for tokenization. Tokens are used in [syntax highlighting](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide).
* `language-configuration.json` - this is the [language configuration](https://code.visualstudio.com/api/language-extensions/language-configuration-guide), defining the tokens that are used for comments and brackets.

## Get up and running straight away

* Run `npm install` and `npm run compile` (F5 also runs the watch build task).
* Make sure the language configuration settings in `language-configuration.json` are accurate.
* Press `F5` to open a new window with your extension loaded.
* Create a new file with a file name suffix matching your language, or open an existing project that uses the language.
* Verify that syntax highlighting works and that the language configuration settings are working.
* Use the scope inspector tool to check that parts of the language are classified correctly according to the grammar. Run the scope inspector with the command `Developer: Inspect Editor Tokens and Scopes`

## Make changes

* You can relaunch the extension from the debug toolbar after making changes to the files listed above.
* You can also reload (`Ctrl+R` or `Cmd+R` on Mac) the VS Code window with your extension to load your changes.

## Add more language features

* To add features such as IntelliSense, hovers and validators check out the VS Code extenders documentation at https://code.visualstudio.com/api/language-extensions/overview

## Install your extension

* To start using your extension with Visual Studio Code copy it into the `<user home>/.vscode/extensions` folder and restart Code.
* To share your extension with the world, read on https://code.visualstudio.com/api/working-with-extensions/publishing-extension about publishing an extension.

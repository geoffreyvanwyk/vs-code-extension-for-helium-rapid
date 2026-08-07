# Language Support for Helium Rapid 

Provides language support for the domain-specific language of the Helium Rapid
application platform.

## Features

This extension provides the following: 

* Syntax Highlighting
* Go to Definition across workspace `.mez` files for:
    - Objects, enums, validators, and units
    - Functions and enum members
    - Object attributes when the receiver type is known (e.g. `shop.shopCode`)
* Find All References across workspace `.mez` files for the same symbol kinds
* Document symbols (Outline / Go to Symbol in Editor) for units, objects, enums, validators, functions, and unit-level variables
* Language Support for:
    - Toggling in-line and block comments.
    - Autoclosing pairs: parentheses, braces, brackets, double quotes.
    - Pairs for surrounding selections: parentheses, braces, brackets, double quotes.

## Release Notes

See [CHANGELOG.md](CHANGELOG.md) for the release notes.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for information on how to work on this VS Code
extension.

## License

Copyright © 2026 Geoffrey Bernardo van Wyk https://geoffreyvanwyk.dev

This file is part of vs-code-extension-for-helium-rapid.

vs-code-extension-for-helium-rapid is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

vs-code-extension-for-helium-rapid is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with vs-code-extension-for-helium-rapid. If not, see https://www.gnu.org/licenses/.

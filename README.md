# plugin-html
HTML plugin for sitespeed.io

## Overview

The `plugin-html` is a plugin for [sitespeed.io](https://www.sitespeed.io/) that helps identify and log HTML errors during web testing. It integrates with sitespeed.io to provide detailed information about HTML errors.

## Features


## Installation

To install the plugin, run the following command:

```sh
npm install plugin-HTML
```

## Usage

To use the plugin with sitespeed.io, add it to your sitespeed.io configuration file or command line options.

### Configuration

Add the plugin to your sitespeed.io configuration file:

```json
{
  "plugins": {
    "plugin-html": {
      "enabled": true
    }
  }
}
```

### Command Line

You can also enable the plugin via the command line:

```sh
sitespeed.io --plugins.add plugin-html
```

## Example

Here is an example of how to use the plugin with sitespeed.io:

```sh
sitespeed.io https://www.example.com --plugins.add plugin-html
```

## Development

### Running Tests

To run the tests, use the following command:

```sh
npm test
```

### Linting

To lint the code, use the following command:

```sh
npm run lint
```

To automatically fix linting issues, use the following command:

```sh
npm run lint:fix
```

### License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on GitHub.

## Author

- **7h3Rabbit** - [GitHub](https://github.com/7h3Rabbit)

## Acknowledgements

- [sitespeed.io](https://www.sitespeed.io/)
- [plugin-webperf-core](https://www.npmjs.com/package/plugin-webperf-core)

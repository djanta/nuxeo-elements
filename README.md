# 🚨 Deprecated 🚨

This branch is not maintained anymore. Please refer to the repository's default branch.

# About nuxeo-elements

**Nuxeo Elements** helps developers build custom elements and web applications with Nuxeo using [web components](https://developer.mozilla.org/en-US/docs/Web/Web_Components). It is build on top of [Polymer 3](https://polymer-library.polymer-project.org/3.0/docs/about_30).

## Dependencies

To install the project's dependencies:

```
npm install
npm run bootstrap
```
Note: This version of Nuxeo Elements requires node version >=10.23.0.

## Quickstart

To run all unit tests with:

```
npm test
```

You can run the unit tests for a given package (`core`, `ui` or `dataviz`) via:

```
npm run test:<package>
```

There is also a `grep` argument that can be used to run a specific set of tests

```
# Runs all the tests present on "core/test/nuxeo-connection.test.js" file
npm run test:core -- --grep nuxeo-connection.test.js

# Runs all the tests present on both "core/test/nuxeo-connection.test.js" and "core/test/nuxeo-document.test.js" files
npm run test:core -- --grep (nuxeo-connection.test.js|nuxeo-document.test.js)
```

To watch the tests for changes you can use:

```
npm run test:watch -- --package=<package>
```

The `grep` argument can also be used here:

```
# Runs all the tests present on "ui/test/nuxeo-date.test.js" file
npm run test:watch -- --package=ui --grep=nuxeo-date.test.js

# Runs all the tests present on both "ui/test/nuxeo-date.test.js" and "ui/test/nuxeo-date-picker.test.js" files
npm run test:watch -- --package=ui --grep=(nuxeo-date.test.js|nuxeo-date-picker.test.js)
```

Demos can be setup using:

```
npm run docs
```

## Documentation

- [Nuxeo Elements](https://doc.nuxeo.com/x/XJCRAQ) in our Developer Documentation Center.
- [Online](http://nuxeo.github.io/nuxeo-elements) reference and demos.

## Report & Contribute

We are glad to welcome new developers on this initiative, and even simple usage feedback is great.
- Ask your questions on [Nuxeo Answers](http://answers.nuxeo.com)
- Report issues on our [JIRA](https://jira.nuxeo.com/browse/ELEMENTS)
- Contribute: Send pull requests!

## Big Thanks

Cross-browser Testing Platform and Open Source <3 Provided by [Sauce Labs](https://saucelabs.com)

## License

[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0.txt)

(C) Copyright Nuxeo Corp. (http://nuxeo.com/)

All images, icons, fonts, and videos contained in this folder are copyrighted by Nuxeo, all rights reserved.

## About Nuxeo
Nuxeo dramatically improves how content-based applications are built, managed and deployed, making customers more agile, innovative and successful. Nuxeo provides a next generation, enterprise ready platform for building traditional and cutting-edge content oriented applications. Combining a powerful application development environment with SaaS-based tools and a modular architecture, the Nuxeo Platform and Products provide clear business value to some of the most recognizable brands including Verizon, Electronic Arts, Sharp, FICO, the U.S. Navy, and Boeing. Nuxeo is headquartered in New York and Paris. More information is available at [www.nuxeo.com](http://www.nuxeo.com).

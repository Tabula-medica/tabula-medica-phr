module.exports = {
  ci: {
    collect: {
      staticDistDir: "./dist/web",
      url: ["/"],
      numberOfRuns: 1,
      settings: {
        preset: "desktop",
        throttlingMethod: "simulate",
        screenEmulation: {
          mobile: false,
          width: 1350,
          height: 940,
          deviceScaleFactor: 1,
          disabled: false,
        },
      },
    },
    assert: {
      assertions: {
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "audits/largest-contentful-paint": [
          "error",
          { maxNumericValue: 2500 },
        ],
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};

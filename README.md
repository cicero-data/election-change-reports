# cicero chamber change reports

Calculate and display changes to legislative chambers when new officials take office following an election. Also display availability of email, webform, facebook and twitter contact information for officials in the chamber.

Swap-out and configure legislative data and geographies then automatically generate a series of infographics for each chamber following an election.

## Learn More

![Azavea](https://www.azavea.com/wp-content/uploads/2016/06/azavea-logo-2x.png)

![Cicero](images/cicero_light_sm.png)

A project of [Cicero Data](https://www.cicerodata.com/).

Read more about the methods used in this project on the [Azavea Blog, "Leveraging Node.js, D3.js, and HTML Canvas for Scalable Infographics"](https://www.azavea.com/blog/2017/07/20/node-js-d3-canvas-scalable-graphics/).

For more information about Azavea's redistricting work, read ["The Evolution of Azavea’s Redistricting and Gerrymandering Work"](https://www.azavea.com/blog/2017/07/18/the-evolution-of-azaveas-redistricting-and-gerrymandering-work/).

## Data

This project is setup to generate reports on data of changes to legislative chambers between to dates. The file chamber-change.csv is the data used to generate reports.


## Install

Requires [Node.js](https://nodejs.org/).

Install dependencies with:

`npm install`


## Setup Election

Edit `config.yml` to point to your election data.


## Generate Reports

`npm run reports`

Images for each delegation will be written to the `change-reports` directory.

## Generate Static HTML Page

`npm run html`

Graphics will be written to `index.html`. Publish this page using [Github Pages](https://pages.github.com/)

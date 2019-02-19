var fs = require('fs'),
    csv = require('csv-parse'),
    d3 = Object.assign({}, require("d3-geo"), require("d3-geo-projection"), require('d3-scale'), require('d3-color')),
    YAML = require('yamljs');

const { createCanvas, loadImage } = require('canvas')
const { Image } = require('canvas')

// Load configuration
var config = YAML.load('config.yml');

// Print some helpful information to console
process.stdout.write(
  '===============================\n' +
  'Reporting Efficiency Gap Scores\n' +
  '===============================\n' +
  'Change Statistics: ' + config.changefilename + '\n' +
  'Local centroids: ' + config.localcentgeojson + '\n\n' +
  'State boundaries: ' + config.statepolygeojson + '\n\n' +
  'Infographics being added to `' + config.outputDirectory + '`\n\n'
);



// A collection of districts
class Chamber {
  constructor(name, abbreviation, geometry, point, data) {
    this.name = name;
    this.abbreviation = abbreviation;
    this.geometry = geometry;
    this.point = point;
    this.stats = data;
  }


  // District Boundaries: a GeoJSON FeatureCollection of the District's geographic bounds
  get districtBoundaries() {
    var boundaries = { type: 'FeatureCollection', features: [] };
    boundaries.features.push(this.geometry);
    boundaries.features.push(this.point);
    return boundaries;
  }

}

// Party: one of two political parties in the election
class Party {
  constructor(name, color) {
    this.name = name;
    this.color = color;
  }
}

// Election Results: the results for a set of Chambers from an election between a left-Party and a right-Party
class ElectionResults {
  constructor(leftParty, rightParty, Chambers) {
    this.parties = { left: leftParty, right: rightParty };
    this.Chambers = Chambers;
  }
}

// ChangeReport: the report for a set of Chambers from an election between a left-Party and a right-Party
class ChangeReport {
  constructor(leftParty, rightParty, otherParty, Chambers) {
    this.parties = { left: leftParty, right: rightParty, other: otherParty };
    this.Chambers = Chambers;
  }
}


// Empty arrays for recording Chambers
var ChamberIdentifiers = [],
    collectedChambers = [];

// Load CSV and GeoJSON file
var csvData = fs.readFileSync(config.changefilename, 'utf8');
var geojsonLocalCent = JSON.parse(fs.readFileSync(config.localcentgeojson, 'utf8'));
var geojsonStatePoly = JSON.parse(fs.readFileSync(config.statepolygeojson, 'utf8'));



// Reformat CSV results and GeoJSON boundaries to an Election Results
csv(csvData, { columns: true }, function(err,data) {

  data.map(function(d) {

    //var ChamberIdentifier = d[config.ChamberIdentifier]
    var ChamberStateId = d['state']
    var ChamberIdentifier = d['id']

    // Add new Chamber
    if (ChamberIdentifiers.indexOf(ChamberIdentifier) === -1) {
      ChamberIdentifiers.push(ChamberIdentifier);


      //state gets state, city with poly gets city, city without poly gets state poly and city centroid 
      var chamberGeometry = geojsonStatePoly.features.find(function(f) {
        return f.properties['STUSPS'] === ChamberStateId;
      });
      


      var chamberLocalPoint = geojsonLocalCent.features.find(function(f) {
           return f.properties['id'] === ChamberIdentifier;
      });


      //var ChamberName = d[config.ChamberName];
      var ChamberName = d['name_formal'];
      

      collectedChambers.push(new Chamber(ChamberName, ChamberIdentifier, chamberGeometry, chamberLocalPoint, d, []))
    }

  });

  var dataLeftParty = new Party(config.partyLeftName, '#45bae8');
  var dataRightParty = new Party(config.partyRightName, '#ff595f');
  var dataOtherParty = new Party(config.partyOtherName, '#d3d3d3');

  var results = new ChangeReport(dataLeftParty, dataRightParty, dataOtherParty, collectedChambers);

  // Generate infographics
  report(results);
});

// A function that generates infographics from an Election Results object
function report(election) {

  // Generate a report for each Chamber
  for (var i = 0; i < election.Chambers.length; i++) {
    var Chamber = election.Chambers[i];
    var geometry = Chamber.geometry;
    var point = Chamber.point;

    // Canvas dimensions
    var width = 1200,
        height = 630,
        leftMargin = 60;

    // A new Canvas object to draw on
    var canvas = createCanvas(width, height),
        context = canvas.getContext("2d");


    // Design Parameters //

    // Layout
    var grid = Math.floor(height / 10);

    // Style
    var background = '#292d39',
        ptbackground = '#bfff80',
        titleFont = 'bold 42px Helvetica',
        subtitleFont = '34px Helvetica',
        sentenceFill = '#fff',
        sentenceFont = '24px Helvetica',
        sentenceBoldFont = 'bold 24px Helvetica',
        annotationFont = 'bold 20px Helvetica',
        annotationMargin = 10,
        disclaimerFont = '15px Helvetica',
        districtStroke = '#fff',
        annotationColor = '#ccc';

    // Bar Graph
    var graphWidth = width / 2 - leftMargin,
        graphHeight = 360,
        graphOriginX = leftMargin,
        graphOriginY = Math.floor(grid * 3.5),
        rectangleHeight = Math.round(graphHeight * 0.10);

    // Map
    var mapWidth = width * 0.44,
        mapHeight = height - Math.round(grid * 1.5);

    // Background
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Custom map projection for each Chamber
    var projection = d3.geoAlbers();
    var path = d3.geoPath()
        .projection(projection);

    var b = path.bounds(geometry),
      centroid = d3.geoCentroid(geometry),
      pOffset = b[1][1] - b[0][1] * 0.3;

    projection
        .rotate([-1 * centroid[0]])
        .scale(1)
        .translate([0, 0]);

    bounds = path.bounds(geometry);

    var scale = 0.9 / Math.max((bounds[1][0] - bounds[0][0]) / mapWidth, (bounds[1][1] - bounds[0][1]) / mapHeight),
        translate = [(mapWidth - scale * (bounds[1][0] + bounds[0][0])) / 2 + (width - mapWidth), grid * 1.5 + (mapHeight - scale * (bounds[1][1] + bounds[0][1])) / 2];

    projection
        .scale(scale)
        .translate(translate);

    // Draw districts shadow
    context.fillStyle = d3.color(background).darker(1).toString();
    context.beginPath();
    path.context(context)(geometry);
    context.fill();


    // Draw districts
    translate[0] -= 6;
    translate[1] -= 6;

    projection.translate(translate);

    // Draw districts
    context.strokeStyle = districtStroke;
    context.fillStyle = background;//d3.color(background).brighter(1).toString();
    context.beginPath();
    path.context(context)(geometry);
    context.fill();
    context.stroke();

    // Draw point
    context.strokeStyle = districtStroke;
    context.fillStyle = ptbackground;//d3.color(background).brighter(1).toString();
    context.beginPath();
    path.context(context)(point);
    context.fill();
    context.stroke();

    // Title Box
    context.fillStyle = '#000';
    context.globalAlpha = 0.35;
    context.fillRect(0, 0, width, Math.round(grid * 1.5));
    context.globalAlpha = 1.0;

    context.fillStyle = sentenceFill;

    // Title
    var titleText = Chamber.name;
    context.font = titleFont;
    context.fillText(titleText, leftMargin, grid);
    var titleWidth = context.measureText(titleText).width;

    // Subtitle
    var subtitleText = 'Feb 2019';
    context.font = subtitleFont;
    context.textAlign = 'end';
    context.globalAlpha = 0.35;
    context.fillText(subtitleText, width - leftMargin, grid);
    context.textAlign = 'start';
    context.globalAlpha = 1.0;

    // A Sentence class with methods for writing text
    class Sentence {
      constructor(initialX, initialY, initialFont, highlightColor, newlineGap) {
        this.xPosition = initialX;
        this.xBaseline = initialX;
        this.yPosition = initialY;
        this.style = initialFont;
        this.highlightColor = highlightColor;
        this.newlineGap = newlineGap;
      }

      // Write: a method to incrementally write a sentence onto the Canvas
      write(text, style, highlight, newline) {
        if (style) { this.style = style; }
        context.font = this.style;
        if (newline) {
          this.yPosition += this.newlineGap;
          this.xPosition = this.xBaseline;
        }
        if (highlight) {
          var textFill = context.fillStyle;
          context.fillStyle = this.highlightColor;
          context.globalAlpha = 0.35;
          context.fillRect(this.xPosition - 5, this.yPosition - 24, context.measureText(text).width + 10, 34);
          context.fillStyle = textFill;
          context.globalAlpha = 1.0;
        }

        context.fillText(text, this.xPosition, this.yPosition);

        this.xPosition += context.measureText(text).width;
      }
    }

    // New Officials Sentence
    var mainSentenceContent = [
      // First Line
      { t: (Chamber.stats.official_count - Chamber.stats.retu_tot ), s: sentenceBoldFont, h: true, n: false },
      { t: ' out of ' , s: sentenceBoldFont, h: false, n: false},
      { t: (Chamber.stats.official_count) , s: sentenceBoldFont, h: true, n: false},
      { t: ' members serving in the ', s: sentenceBoldFont, h: false, n: false },
      { t: Chamber.name, s: sentenceBoldFont, h: true, n: true },
      { t: 'are new to office following the November 6, 2018 elections.', s: sentenceBoldFont, h: false, n: true },
    ];

    // Write the new officials sentence
    var mainSentence = new Sentence(leftMargin, Math.ceil(grid * 2.375), sentenceFont, '#bfff80'  , 34);
    mainSentenceContent.map(function(phrase) {
      mainSentence.write(phrase.t, phrase.s, phrase.h, phrase.n);
    });

    // Bar graph
    var rectangleBaseline =  {
        c_ch_l: Math.floor(graphOriginY + graphHeight * (2/16) ),
        c_ch_b: Math.floor(graphOriginY + graphHeight * (3/16)),
        o_ch_l: Math.floor(graphOriginY + graphHeight * (7/16)),
        o_ch_b: Math.floor(graphOriginY + graphHeight * (1/2)),
        sm_t: Math.floor(graphOriginY + graphHeight * (3/4)),
        sm_b: Math.floor(graphOriginY + graphHeight * (7/8))
    }


    var cvotes = [ parseInt(Chamber.stats.cdem_tot) , parseInt(Chamber.stats.crep_tot), 
            parseInt(Chamber.stats.official_count)]
    var ovotes = [ parseInt(Chamber.stats.odem_tot) , parseInt(Chamber.stats.orep_tot),
            parseInt(Chamber.stats.official_count)]


    voteScale = d3.scaleLinear()
      .domain([0, Chamber.stats.official_count ])
      .range([0, graphWidth]);

    context.font = annotationFont;

    //// Draw rectangles for votes in current session

    context.fillText('Current Legislative Term', graphOriginX, rectangleBaseline.c_ch_l - annotationMargin);

    if (cvotes[0] >= 1) {
      // Left Party
      //// shadow
      context.fillStyle = d3.color(election.parties.left.color).darker(1).toString();
      context.fillRect(graphOriginX + 1, rectangleBaseline.c_ch_b, voteScale(cvotes[0]) - 4, rectangleHeight);
      //// highlight
      context.fillStyle = d3.color(election.parties.left.color).brighter(1).toString();
      context.fillRect(graphOriginX + 3, rectangleBaseline.c_ch_b, voteScale(cvotes[0]) - 4, rectangleHeight);
      //// fill
      context.fillStyle = election.parties.left.color;
      context.fillRect(graphOriginX + 2, rectangleBaseline.c_ch_b, voteScale(cvotes[0]) - 4, rectangleHeight);

      context.fillText( cvotes[0] + ' ' + election.parties.left.name
          , graphOriginX, rectangleBaseline.c_ch_b - annotationMargin);

    }

    if (cvotes[1] >= 1) {
      // Right Party
      //// shadow
      context.fillStyle = d3.color(election.parties.right.color).darker(1).toString();
      context.fillRect(graphOriginX + voteScale(cvotes[0]) + 2, rectangleBaseline.c_ch_b, voteScale(cvotes[1]) - 4, rectangleHeight);    //// highlight
      //// highlight
      context.fillStyle = d3.color(election.parties.right.color).brighter(1).toString();
      context.fillRect(graphOriginX + voteScale(cvotes[0]) + 4, rectangleBaseline.c_ch_b, voteScale(cvotes[1]) - 4, rectangleHeight);    //// fill
      //// fill
      context.fillStyle = election.parties.right.color;
      context.fillRect(graphOriginX + voteScale(cvotes[0]) + 3, rectangleBaseline.c_ch_b, voteScale(cvotes[1]) - 4, rectangleHeight);

      context.textAlign = 'end';
      context.fillText( cvotes[1] +' '+ election.parties.right.name  
        , graphOriginX + graphWidth, rectangleBaseline.c_ch_b - annotationMargin);
      context.textAlign = 'start';
    }

    if (cvotes[2] >= 1) {
      // Other Party
      //// fill
      context.fillStyle = election.parties.other.color;
      context.fillRect(graphOriginX + voteScale(cvotes[0]) + voteScale(cvotes[1]) + 3, rectangleBaseline.c_ch_b, voteScale(cvotes[2] - (cvotes[0] + cvotes[1]) ) - 4, rectangleHeight);
    }

    //// Draw rectangles for votes in previous session
    context.fillText('Previous Legislative Term', graphOriginX, rectangleBaseline.o_ch_l - annotationMargin);

    if (ovotes[0] >= 1) {
      // Left Party
      //// shadow
      context.fillStyle = d3.color(election.parties.left.color).darker(1).toString();
      context.fillRect(graphOriginX + 1, rectangleBaseline.o_ch_b, voteScale(ovotes[0]) - 4, rectangleHeight);
      //// highlight
      context.fillStyle = d3.color(election.parties.left.color).brighter(1).toString();
      context.fillRect(graphOriginX + 3, rectangleBaseline.o_ch_b, voteScale(ovotes[0]) - 4, rectangleHeight);
      //// fill
      context.fillStyle = election.parties.left.color;
      context.fillRect(graphOriginX + 2, rectangleBaseline.o_ch_b, voteScale(ovotes[0]) - 4, rectangleHeight);

      context.fillText( ovotes[0] + ' ' + election.parties.left.name
         , graphOriginX, rectangleBaseline.o_ch_b - annotationMargin);

    }

    if (ovotes[1] >= 1) {
      // Right Party
      //// shadow
      context.fillStyle = d3.color(election.parties.right.color).darker(1).toString();
      context.fillRect(graphOriginX + voteScale(ovotes[0]) + 2, rectangleBaseline.o_ch_b, voteScale(ovotes[1]) - 4, rectangleHeight);    //// highlight
      //// highlight
      context.fillStyle = d3.color(election.parties.right.color).brighter(1).toString();
      context.fillRect(graphOriginX + voteScale(ovotes[0]) + 4, rectangleBaseline.o_ch_b, voteScale(ovotes[1]) - 4, rectangleHeight);    //// fill
      //// fill
      context.fillStyle = election.parties.right.color;
      context.fillRect(graphOriginX + voteScale(ovotes[0]) + 3, rectangleBaseline.o_ch_b, voteScale(ovotes[1]) - 4, rectangleHeight);

      context.textAlign = 'end';
      context.fillText( ovotes[1] + ' ' + election.parties.right.name 
        , graphOriginX + graphWidth, rectangleBaseline.o_ch_b - annotationMargin);
      context.textAlign = 'start';
    }

    if (cvotes[2] >= 1) {
      // Other Party
      //// fill
      context.fillStyle = election.parties.other.color;
      context.fillRect(graphOriginX + voteScale(ovotes[0]) + voteScale(ovotes[1]) + 3, rectangleBaseline.o_ch_b, voteScale(cvotes[2] - (ovotes[0] + ovotes[1]) ) - 4, rectangleHeight);
    }



      // Right Party
      //// shadow
      context.fillStyle = ptbackground;
      context.textAlign = 'end';
      context.fillText(Math.round(Chamber.stats.emai_tot / (Chamber.stats.official_count) * 100) + '% Email ', 
        graphOriginX + graphWidth * (1/2), rectangleBaseline.sm_t - annotationMargin);
      context.textAlign = 'start';

      var em_logo = fs.readFileSync('images/email.svg');
      const em_image = new Image()
      em_image.src = em_logo;
      context.globalAlpha = 0.6;
      context.drawImage(em_image, graphOriginX, rectangleBaseline.sm_t - annotationMargin - 20, 40,40);
      context.globalAlpha = 1.0;
    

      context.textAlign = 'end';
      context.fillText(Math.round(Chamber.stats.wfor_tot / (Chamber.stats.official_count) * 100) + '% Webform ', 
        graphOriginX + graphWidth, rectangleBaseline.sm_t - annotationMargin);
      context.textAlign = 'start';

      var wf_logo = fs.readFileSync('images/mail-bulk.svg');
      const wf_image = new Image()
      wf_image.src = wf_logo;
      context.globalAlpha = 0.6;
      context.drawImage(wf_image, graphOriginX + graphWidth * (1/2) , rectangleBaseline.sm_t - annotationMargin - 20, 40,40);
      context.globalAlpha = 1.0;

      context.textAlign = 'end';
      context.fillText(Math.round(Chamber.stats.yfcb_tot / (Chamber.stats.official_count) * 100) + '% Facebook ', 
        graphOriginX + graphWidth * (1/2), rectangleBaseline.sm_b - annotationMargin);
      context.textAlign = 'start';

      var fb_logo = fs.readFileSync('images/facebook-sq.svg');
      const fb_image = new Image()
      fb_image.src = fb_logo;
      context.globalAlpha = 0.6;
      context.drawImage(fb_image, graphOriginX, rectangleBaseline.sm_b - annotationMargin - 20, 40,40);
      context.globalAlpha = 1.0;

      context.textAlign = 'end';
      context.fillText(Math.round(Chamber.stats.ytwi_tot / (Chamber.stats.official_count) * 100) + '% Twitter ', 
        graphOriginX + graphWidth , rectangleBaseline.sm_b - annotationMargin);
      context.textAlign = 'start';

      var tw_logo = fs.readFileSync('images/twitter-sq.svg');
      const tw_image = new Image()
      tw_image.src = tw_logo;
      context.globalAlpha = 0.6;
      context.drawImage(tw_image, graphOriginX + graphWidth * (1/2), rectangleBaseline.sm_b - annotationMargin - 20, 40,40);
      context.globalAlpha = 1.0;

    // Azavea Logo    
    var logo = fs.readFileSync('images/cicero_light_sm.png');
    const image = new Image()
    image.src = logo;
    context.globalAlpha = 0.6;
    context.drawImage(image, leftMargin, height - leftMargin * 1.1);
    context.globalAlpha = 1.0;

    process.stdout.write(Chamber.name + ': ' + Math.round(Chamber.efficiencyGapImputation * 100) / 100 + '\n');

    // Save image to the output directory
    canvas.pngStream().pipe(fs.createWriteStream(config.outputDirectory + '/' + Chamber.name + ".png"));

  }
}

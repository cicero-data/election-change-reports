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


// Defining Classes

// District: a geographic area represented by one seat in the Chamber; votes are cast for one candidate in each party
class District {
  constructor(identifier, votes, feature) {
    this.identifier = identifier;
    this.votes = votes.map(function(v) { return parseInt(v, 10); });
    this.boundary = feature;
  }

  // Result: index of the victorious party; 0=left, 1=right
  get result() {
    return this.votes[0] > this.votes[1] ? 0 : 1;
  }

  // Margin: the number of left-candidate's votes subtracted from the number of right-candidates vote; negative numbers show left victory
  get margin() {
    return this.votes[1] - this.votes[0];
  }
}

// A collection of districts
class Chamber {
  constructor(name, abbreviation, geometry, point, data) {
    this.name = name;
    this.abbreviation = abbreviation;
    this.geometry = geometry;
    this.point = point;
    this.stats = data;
  }


  get seat() {
    return this.stats['official_count'];
  }

  get orep() {
    return this.stats['orep_tot'];
  }

  get odem() {
    return this.stats['odem_tot'];
  }

  get ooth() {
    return this.seat - ( this.orep + this.odem );
  }

  get crep() {
    return this.stats['crep_tot'];
  }

  get cdem() {
    return this.stats['cdem_tot'];
  }

  get coth() {
    return this.seat - ( this.crep + this.cdem );
  }

  get reto() {
    return this.stats['retu_tot'];
  }

  get emai() {
    return this.stats['emai_tot'];
  }

  get wfor() {
    return this.stats['wfor_tot'];
  }

  get yfcb() {
    return this.stats['yfcb_tot'];
  }

  get ytwi() {
    return this.stats['ytwi_tot'];
  }

  get new_officials() {
    return this.stats['official_count'] - this.stats['retu_tot'];
  }

  // // Seat Results: the number of seats won by each party
  // get seatResults() {
  //   var seatResults = [0,0];
  //   this.districts.map(function(d) {
  //     seatResults[d.result]++
  //   });
  //   return seatResults;
  // }

  // // Vote Results: the number of votes won by each party
  // get voteResults() {
  //   var voteResults = [0,0];
  //   for (var i = 0; i < this.districts.length; i++) {
  //     voteResults[0] += this.districts[i].votes[0];
  //     voteResults[1] += this.districts[i].votes[1];
  //   };
  //   return voteResults;
  // }

  // // Vote Results Imputation: imputes (guesses) the number of votes that would have been won by each party if all seats had been contested
  // // Conservatively assumes uncontesting party would have won additional votes ammounting to 25% of the new total
  // get voteResultsImputation() {
  //   var voteResultsImputation = [0,0];
  //   for (var i = 0; i < this.districts.length; i++) {
  //     voteResultsImputation[0] += this.districts[i].votes[0] > 0 ? this.districts[i].votes[0] : Math.round(this.districts[i].votes[1] * (1/3));
  //     voteResultsImputation[1] += this.districts[i].votes[1] > 0 ? this.districts[i].votes[1] : Math.round(this.districts[i].votes[0] * (1/3));
  //   };
  //   return voteResultsImputation;
  // }

  // // Uncontested Seats: the number of seats left uncontested by each party
  // get uncontestedSeats() {
  //   var uncontested = [0,0];
  //   var districts = this.districts;
  //   for (var i = 0; i < districts.length; i++) {
  //     if (districts[i].votes[0] === 0) { uncontested[0]++; };
  //     if (districts[i].votes[1] === 0) { uncontested[1]++; };
  //   };
  //   return uncontested;
  // }

  // // Votes: the total number of votes cast
  // get votes() {
  //   return this.voteResults[0] + this.voteResults[1];
  // }

  // // Votes Imputation: imputes (guesses) the total number of votes that would have been cast if all seats had been contested
  // get votesImputation() {
  //   return this.voteResultsImputation[0] + this.voteResultsImputation[1];
  // }

  // // Seat Margin: the amount above or below 50% of all the seats that were won by the right-party; negative indicates left-party won more seats
  // get seatMargin() {
  //   return this.seatResults[1] / this.seats - 0.5;
  // }

  // // Vote Margin: the amount above or below 50% of all the votes that were won by the right-party; negative indicates left-party won more votes
  // get voteMargin() {
  //   return this.voteResults[1] / this.votes - 0.5;
  // }

  // // Vote Margin Imputation: imputes (guesses) the Vote Margin if all seats had been contested
  // get voteMarginImputation() {
  //   return this.voteResultsImputation[1] / this.votesImputation - 0.5;
  // }

  // // Efficiency Gap: a measure of how effectively votes were distributed by the right-party; negative indicates votes were more effectively distributed by the left-party
  // get efficiencyGap() {
  //   return this.seatMargin - (2 * this.voteMargin);
  // }

  // // Efficiency Gap Imputation: imputes (guesses) the Efficiency Gap if all seats had been contested
  // get efficiencyGapImputation() {
  //   return this.seatMargin - (2 * this.voteMarginImputation);
  // }

  // // Efficiency Gap Seats: the seat advantage in the Chamber that results from the Efficiency Gap; negative indicates the left-party had an advantage
  // get efficiencyGapSeats() {
  //   if (this.seats === 1) { return 0; }
  //   else {
  //     var efficiencyGapSeats = Math.round(Math.abs(this.efficiencyGap * this.seats));
  //     if (efficiencyGapSeats === 0) { return 0; }
  //     else {
  //       var benefittingParty = this.efficiencyGap < 0 ? 0 : 1;
  //       return efficiencyGapSeats < this.seatResults[benefittingParty] ? efficiencyGapSeats : this.seatResults[benefittingParty];
  //     }
  //   }
  // }

  // // Efficiency Gap Seats Imputation: imputes (guesses) the Efficiency Gap Seats if all seats had been contested
  // get efficiencyGapSeatsImputation() {
  //   if (this.seats === 1) { return 0; }
  //   else {
  //     var efficiencyGapSeats = Math.round(Math.abs(this.efficiencyGapImputation * this.seats));
  //     if (efficiencyGapSeats === 0) { return 0; }
  //     else {
  //       var benefittingParty = this.efficiencyGapImputation < 0 ? 0 : 1;
  //       return efficiencyGapSeats < this.seatResults[benefittingParty] ? efficiencyGapSeats : this.seatResults[benefittingParty];
  //     }
  //   }
  // }

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
    console.log( 'make change report!! ' )
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
        //return f.properties[config.ChamberIdentifier] === ChamberIdentifier;
        return f.properties['STUSPS'] === ChamberStateId;
      });
      


      var chamberLocalPoint = geojsonLocalCent.features.find(function(f) {
           return f.properties['id'] === ChamberIdentifier;
      });


      //var ChamberName = d[config.ChamberName];
      var ChamberName = d['name_formal'];
      
      //console.log( "name of chamber --> ", d['name_formal'] )

      collectedChambers.push(new Chamber(ChamberName, ChamberIdentifier, chamberGeometry, chamberLocalPoint, d, []))
    }

    //var ChamberIndex = ChamberIdentifiers.indexOf(ChamberIdentifier);

    // Add new district
    //var districtIdentifier = d[config.districtIdentifier];
    //var districtVotes = [d[config.partyLeftVotes], d[config.partyRightVotes]];
    //var districtFeature = geojson.features.filter(function(f) {
     // return f.properties[config.ChamberIdentifier] === ChamberIdentifier && f.properties[config.districtIdentifier] === districtIdentifier;
    //})[0];

    //collectedChambers[ChamberIndex].districts.push(new District(districtIdentifier, districtVotes, districtFeature));

  });

  var dataLeftParty = new Party(config.partyLeftName, '#45bae8');
  var dataRightParty = new Party(config.partyRightName, '#ff595f');
  var dataOtherParty = new Party(config.partyOtherName, '#d3d3d3');


  console.log( 'PARTY --> ', dataLeftParty.color )
  console.log( 'PARTY --> ', dataRightParty.color )
  console.log( 'PARTY --> ', dataOtherParty.color )


  var results = new ChangeReport(dataLeftParty, dataRightParty, dataOtherParty, collectedChambers);

  console.log( 'this results --> ', results.parties.left.color )


  // Generate infographics
  report(results);
});

// A function that generates infographics from an Election Results object
function report(election) {

  // Generate a report for each Chamber
  //for (var i = 0; i < election.Chambers.length; i++) {
  for (var i = 0; i < 15; i++) {
    var Chamber = election.Chambers[i];

    //console.log( 'new officials --> ', Chamber.new_officials())

    //var districts = Chamber.districtBoundaries;
    var geometry = Chamber.geometry;
    var point = Chamber.point;


    // Party Advantage
    //var advantageParty = undefined;
    //if (Chamber.efficiencyGapImputation <= 0) { advantageParty = 'left'; }
    //if (Chamber.efficiencyGapImputation > 0) { advantageParty = 'right'; }

    // Formatted Efficiency Gap advantage
    //var efficiencyGapPercent = Math.round(Math.abs(Chamber.efficiencyGapImputation) * 1000) / 10 + '%'

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
    var subtitleText = 'Cicero database 2019 coverage';
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

    // Caveats for uncontested races
    //var uncontested = Chamber.uncontestedSeats;

    //var uncontestedSeats = (uncontested[0] === 0 && uncontested[1] === 0) ? false : true;
    //var significantAdvantage = Chamber.efficiencyGapSeatsImputation !== 0;


    console.log( '49085349865  ',  Chamber.stats.official_count ) 
    // New Officials Sentence
    var mainSentenceContent = [
      // First Line
      //{ t: 'The ', s: sentenceFont, h: false, n: false },
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

    // var mainSentenceContent = [
    //   // First Line
    //   { t: 'The ', s: sentenceFont, h: false, n: false },
    //   { t: election.parties[advantageParty].name + ' Party', s: sentenceBoldFont, h: !uncontestedSeats && significantAdvantage, n: false },
    //   { t: ' had a', s: sentenceFont, h: false, n: false },
    //   // Second Line
    //   { t: efficiencyGapPercent + ' efficiency gap advantage*', s: sentenceBoldFont, h: !uncontestedSeats && significantAdvantage, n: true },
    //   // Third Line
    //   { t: 'worth ', s: sentenceFont, h: false, n: true },
    //   { t: Math.abs(Chamber.efficiencyGapSeatsImputation) + ' extra ' + (Chamber.efficiencyGapSeatsImputation === 1 ? 'seat' : 'seats'), s: sentenceBoldFont, h: !uncontestedSeats && significantAdvantage, n: false },
    //   { t: (uncontestedSeats ? ', but some seats' : '.'), s: sentenceFont, h: false, n: false },
    //   // Possible Fourth Line
    //   { t: (uncontestedSeats ? 'were left uncontested.**' : ''), s: sentenceFont, h: false, n: true },
    // ];

    // // Write the context sentence
    // var mainSentence = new Sentence(leftMargin, Math.ceil(grid * 2.375), sentenceFont, election.parties[advantageParty].color, 48);
    // mainSentenceContent.map(function(phrase) {
    //   mainSentence.write(phrase.t, phrase.s, phrase.h, phrase.n);
    // });




    // // Main sentence
    // var mainSentenceContent = [
    //   // First Line
    //   { t: 'The ', s: sentenceFont, h: false, n: false },
    //   { t: election.parties[advantageParty].name + ' Party', s: sentenceBoldFont, h: !uncontestedSeats && significantAdvantage, n: false },
    //   { t: ' had a', s: sentenceFont, h: false, n: false },
    //   // Second Line
    //   { t: efficiencyGapPercent + ' efficiency gap advantage*', s: sentenceBoldFont, h: !uncontestedSeats && significantAdvantage, n: true },
    //   // Third Line
    //   { t: 'worth ', s: sentenceFont, h: false, n: true },
    //   { t: Math.abs(Chamber.efficiencyGapSeatsImputation) + ' extra ' + (Chamber.efficiencyGapSeatsImputation === 1 ? 'seat' : 'seats'), s: sentenceBoldFont, h: !uncontestedSeats && significantAdvantage, n: false },
    //   { t: (uncontestedSeats ? ', but some seats' : '.'), s: sentenceFont, h: false, n: false },
    //   // Possible Fourth Line
    //   { t: (uncontestedSeats ? 'were left uncontested.**' : ''), s: sentenceFont, h: false, n: true },
    // ];

    // // Write the context sentence
    // var mainSentence = new Sentence(leftMargin, Math.ceil(grid * 2.375), sentenceFont, election.parties[advantageParty].color, 48);
    // mainSentenceContent.map(function(phrase) {
    //   mainSentence.write(phrase.t, phrase.s, phrase.h, phrase.n);
    // });


    // // Explanation
    // var explanationSentenceContent = [
    //   {
    //     t: ' * The "efficiency gap" measures how effectively a party\'s votes ',
    //     s: disclaimerFont, h: false, n: false },
    //     {
    //       t: '    are distributed among districts and reveals partisan bias.',
    //       s: disclaimerFont, h: false, n: true }
    // ];

    // var explanationSentence = new Sentence(leftMargin * 4, uncontestedSeats ? Math.ceil(grid * 8.5) : height - leftMargin * 0.8, disclaimerFont, annotationColor, 18);
    // explanationSentenceContent.map(function(phrase) {
    //   explanationSentence.write(phrase.t, phrase.s, phrase.h, phrase.n);
    // });

    // // Disclaimers
    // if (uncontestedSeats) {
    //   var estimateDisclaimerSentenceContent = [
    //     {
    //       t: '** This efficiency gap score assumes an opponent would have won',
    //       s: disclaimerFont, h: false, n: false },
    //     {
    //       t: '    25% of the vote in uncontested seats.',
    //       s: disclaimerFont, h: false, n: true }
    //   ];

    //   var estimateDisclaimerSentence = new Sentence(leftMargin * 4, height - leftMargin * 0.8, disclaimerFont, annotationColor, 18);
    //   estimateDisclaimerSentenceContent.map(function(phrase) {
    //     estimateDisclaimerSentence.write(phrase.t, phrase.s, phrase.h, phrase.n);
    //   });
    // }

    // Bar graph
    var VoteRectangleBaseline = [Math.floor(graphOriginY + graphHeight * (1/4)),
                                 Math.ceil(graphOriginY + graphHeight * (1/2)),
                                 Math.ceil(graphOriginY + graphHeight * (3/4)),
                                 Math.ceil(graphOriginY + graphHeight * (7/8))]

    var rectangleBaseline =  {
        c_ch_l: Math.floor(graphOriginY + graphHeight * (2/16) ),
        c_ch_b: Math.floor(graphOriginY + graphHeight * (3/16)),
        o_ch_l: Math.floor(graphOriginY + graphHeight * (7/16)),
        o_ch_b: Math.floor(graphOriginY + graphHeight * (1/2)),
        sm_t: Math.floor(graphOriginY + graphHeight * (3/4)),
        sm_b: Math.floor(graphOriginY + graphHeight * (7/8))
    }
    console.log( "doop ",  rectangleBaseline.c_ch_b )

    // [Math.floor(graphOriginY + graphHeight * (1/4)),
    //                              Math.ceil(graphOriginY + graphHeight * (1/2)),
    //                              Math.ceil(graphOriginY + graphHeight * (3/4)),
    //                              Math.ceil(graphOriginY + graphHeight * (7/8))]

    //var votes = Chamber.voteResults,
        //seats = Chamber.seatResults;

    var cvotes = [ parseInt(Chamber.stats.cdem_tot) , parseInt(Chamber.stats.crep_tot), 
            parseInt(Chamber.stats.official_count)]
    var ovotes = [ parseInt(Chamber.stats.odem_tot) , parseInt(Chamber.stats.orep_tot),
            parseInt(Chamber.stats.official_count)]

    //console.log( 'votes', votes, typeof votes[0],  typeof votes[1] )

    voteScale = d3.scaleLinear()
      .domain([0, Chamber.stats.official_count ])
      .range([0, graphWidth]);

    //var seatRectangleMargin = 4,
    //    seatRectangleWidth = Math.floor(graphWidth / Chamber.seats) - seatRectangleMargin;

    // seatScale = d3.scaleLinear()
    //   .domain([1, Chamber.seats])
    //   .range([
    //     graphOriginX + 2,
    //     (graphOriginX + graphWidth) - Math.floor((graphWidth / Chamber.seats)) + seatRectangleMargin
    //   ]);

    console.log( 'current --> ', cvotes[0], cvotes[1], cvotes[0]+ cvotes[1] +cvotes[2] , Chamber.stats.official_count  )
    console.log( 'old --> ', ovotes[0], ovotes[1], ovotes[0]+ ovotes[1]+ovotes[2], Chamber.stats.official_count  )


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

      context.fillText(cvotes[2] - ((cvotes[0] + cvotes[1])) + ' / '  + cvotes[2] + ' ' + election.parties.left.name +
       ' vote', graphOriginX, rectangleBaseline.c_ch_b - annotationMargin);

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
      context.fillText(Math.round(cvotes[1] / (cvotes[0] + cvotes[1]) * 100) + '% ' + election.parties.right.name + 
        ' vote', graphOriginX + graphWidth, rectangleBaseline.c_ch_b - annotationMargin);
      context.textAlign = 'start';
    }

    if (cvotes[2] >= 1) {
      // Other Party
      //// shadow
      //context.fillStyle = d3.color(election.parties.right.color).darker(1).toString();
      //context.fillRect(graphOriginX + voteScale(cvotes[0]) + 2, rectangleBaseline[0], voteScale(cvotes[1]) - 4, rectangleHeight);    //// highlight
      //// highlight
      //context.fillStyle = d3.color(election.parties.right.color).brighter(1).toString();
      //context.fillRect(graphOriginX + voteScale(cvotes[0]) + 4, rectangleBaseline[0], voteScale(cvotes[1]) - 4, rectangleHeight);    //// fill
      //// fill
      context.fillStyle = election.parties.other.color;
      context.fillRect(graphOriginX + voteScale(cvotes[0]) + voteScale(cvotes[1]) + 3, rectangleBaseline.c_ch_b, voteScale(cvotes[2] - (cvotes[0] + cvotes[1]) ) - 4, rectangleHeight);

      //context.textAlign = 'end';
      //context.fillText(Math.round(cvotes[1] / (cvotes[0] + cvotes[1]) * 100) + '% ' + election.parties.right.name + 
      //  ' vote', graphOriginX + graphWidth, rectangleBaseline[0] - annotationMargin);
      //context.textAlign = 'start';
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

      context.fillText(Math.round(ovotes[0] / (ovotes[0] + ovotes[1]) * 100) + '% ' + election.parties.left.name +
       ' vote', graphOriginX, rectangleBaseline.o_ch_b - annotationMargin);

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
      context.fillText(Math.round(ovotes[1] / (ovotes[0] + ovotes[1]) * 100) + '% ' + election.parties.right.name + 
        ' vote', graphOriginX + graphWidth, rectangleBaseline.o_ch_b - annotationMargin);
      context.textAlign = 'start';
    }

    if (cvotes[2] >= 1) {
      // Other Party
      //// shadow
      //context.fillStyle = d3.color(election.parties.right.color).darker(1).toString();
      //context.fillRect(graphOriginX + voteScale(cvotes[0]) + 2, rectangleBaseline[0], voteScale(cvotes[1]) - 4, rectangleHeight);    //// highlight
      //// highlight
      //context.fillStyle = d3.color(election.parties.right.color).brighter(1).toString();
      //context.fillRect(graphOriginX + voteScale(cvotes[0]) + 4, rectangleBaseline[0], voteScale(cvotes[1]) - 4, rectangleHeight);    //// fill
      //// fill
      context.fillStyle = election.parties.other.color;
      context.fillRect(graphOriginX + voteScale(ovotes[0]) + voteScale(ovotes[1]) + 3, rectangleBaseline.o_ch_b, voteScale(cvotes[2] - (ovotes[0] + ovotes[1]) ) - 4, rectangleHeight);

      //context.textAlign = 'end';
      //context.fillText(Math.round(cvotes[1] / (cvotes[0] + cvotes[1]) * 100) + '% ' + election.parties.right.name + 
      //  ' vote', graphOriginX + graphWidth, rectangleBaseline[0] - annotationMargin);
      //context.textAlign = 'start';
    }



      // Right Party
      //// shadow
      // context.fillStyle = d3.color(ptbackground).darker(1).toString();
      // context.fillRect(graphOriginX + 50 + 2, rectangleBaseline[2], 200 - 4, rectangleHeight);    //// highlight
      // //// highlight
      // context.fillStyle = d3.color(election.parties.right.color).brighter(1).toString();
      // context.fillRect(graphOriginX + 50 + 4, rectangleBaseline[2], 200 - 4, rectangleHeight);    //// fill
      // //// fill
      // context.fillStyle = election.parties.right.color;
      // context.fillRect(graphOriginX + 50 + 3, rectangleBaseline[2], 200 - 4, rectangleHeight);

      context.fillStyle = ptbackground;
      context.textAlign = 'end';
      context.fillText(Math.round(Chamber.stats.emai_tot / (Chamber.stats.official_count) * 100) + '% Email ', 
        graphOriginX + graphWidth * (1/2), rectangleBaseline.sm_t - annotationMargin);
      context.textAlign = 'start';

      var em_logo = fs.readFileSync('email.svg');
      const em_image = new Image()
      em_image.src = em_logo;
      context.globalAlpha = 0.6;
      context.drawImage(em_image, graphOriginX, rectangleBaseline.sm_t - annotationMargin - 20, 40,40);
      context.globalAlpha = 1.0;
    

      context.textAlign = 'end';
      context.fillText(Math.round(Chamber.stats.wfor_tot / (Chamber.stats.official_count) * 100) + '% Webform ', 
        graphOriginX + graphWidth, rectangleBaseline.sm_t - annotationMargin);
      context.textAlign = 'start';

      var wf_logo = fs.readFileSync('mail-bulk.svg');
      const wf_image = new Image()
      wf_image.src = wf_logo;
      context.globalAlpha = 0.6;
      context.drawImage(wf_image, graphOriginX + graphWidth * (1/2) , rectangleBaseline.sm_t - annotationMargin - 20, 40,40);
      context.globalAlpha = 1.0;

      context.textAlign = 'end';
      context.fillText(Math.round(Chamber.stats.yfcb_tot / (Chamber.stats.official_count) * 100) + '% Facebook ', 
        graphOriginX + graphWidth * (1/2), rectangleBaseline.sm_b - annotationMargin);
      context.textAlign = 'start';

      var fb_logo = fs.readFileSync('facebook-sq.svg');
      const fb_image = new Image()
      fb_image.src = fb_logo;
      context.globalAlpha = 0.6;
      context.drawImage(fb_image, graphOriginX, rectangleBaseline.sm_b - annotationMargin - 20, 40,40);
      context.globalAlpha = 1.0;

      context.textAlign = 'end';
      context.fillText(Math.round(Chamber.stats.ytwi_tot / (Chamber.stats.official_count) * 100) + '% Twitter ', 
        graphOriginX + graphWidth , rectangleBaseline.sm_b - annotationMargin);
      context.textAlign = 'start';

      var tw_logo = fs.readFileSync('twitter-sq.svg');
      const tw_image = new Image()
      tw_image.src = tw_logo;
      context.globalAlpha = 0.6;
      context.drawImage(tw_image, graphOriginX + graphWidth * (1/2), rectangleBaseline.sm_b - annotationMargin - 20, 40,40);
      context.globalAlpha = 1.0;





    //// Draw rectangles for seats
    // for (var s = 1; s <= Chamber.seats; s++) {
    //   var seatColor = s <= Chamber.seatResults[0] ? election.parties.left.color : election.parties.right.color;

    //   // shadow
    //   context.fillStyle = d3.color(seatColor).darker(1).toString();
    //   context.fillRect(seatScale(s) - 1,seatRectangleBaseline, seatRectangleWidth, rectangleHeight);

    //   // highlight
    //   context.fillStyle = d3.color(seatColor).brighter(1).toString();
    //   context.fillRect(seatScale(s) + 1,seatRectangleBaseline, seatRectangleWidth, rectangleHeight);

    //   // fill
    //   context.fillStyle = seatColor;
    //   context.fillRect(seatScale(s), seatRectangleBaseline, seatRectangleWidth, rectangleHeight);
    // }

    // if (seats[0] >= 1) {
    //   context.fillStyle = election.parties.left.color;
    //   context.fillText(seats[0] + ' ' + election.parties.left.name + ' ' + (seats[0] === 1 ? 'seat' : 'seats'), graphOriginX, seatRectangleBaseline - annotationMargin);
    // }
    // if (seats[1] >= 1) {
    //   context.fillStyle = election.parties.right.color;
    //   context.textAlign = 'end';
    //   context.fillText(seats[1] + ' ' + election.parties.right.name + ' ' + (seats[1] === 1 ? 'seat' : 'seats'), graphOriginX + graphWidth, seatRectangleBaseline - annotationMargin);
    //   context.textAlign = 'start';
    // }


    // // Uncontested races
    // var uncontestedBaseline = seatRectangleBaseline + rectangleHeight + seatRectangleMargin;

    // context.strokeStyle = annotationColor;
    // context.fillStyle = annotationColor;
    // context.lineWidth = 2;
    // context.textAlign = 'center';
    // context.font = annotationFont;
    // context.textBaseline = 'hanging';
    // context.globalAlpha = 0.5;

    // if (uncontested[0] >= 1) {
    //   context.beginPath();
    //   context.moveTo(seatScale(Chamber.seats - uncontested[0] + 1) + seatRectangleWidth / 2, uncontestedBaseline);
    //   context.lineTo(seatScale(Chamber.seats - uncontested[0] + 1) + seatRectangleWidth / 2, uncontestedBaseline + 15);
    //   context.lineTo(seatScale(Chamber.seats) + seatRectangleWidth / 2, uncontestedBaseline + 15);
    //   context.lineTo(seatScale(Chamber.seats) + seatRectangleWidth / 2, uncontestedBaseline);
    //   context.stroke();
    //   context.closePath();

    //   context.fillText('uncontested', seatScale(Chamber.seats - (uncontested[0] - 1) / 2) + seatRectangleWidth / 2, uncontestedBaseline + 20);
    // };

    // if (uncontested[1] >= 1) {
    //   context.beginPath();
    //   context.moveTo(seatScale(1) + seatRectangleWidth / 2, uncontestedBaseline);
    //   context.lineTo(seatScale(1) + seatRectangleWidth / 2, uncontestedBaseline + 15);
    //   context.lineTo(seatScale(uncontested[1]) + seatRectangleWidth / 2, uncontestedBaseline + 15);
    //   context.lineTo(seatScale(uncontested[1]) + seatRectangleWidth / 2, uncontestedBaseline);
    //   context.stroke();
    //   context.closePath();

    //   context.fillText('uncontested', seatScale(1 + (uncontested[1] - 1) / 2) + seatRectangleWidth / 2, uncontestedBaseline + 20);
    // };
    // context.textBaseline = 'alphabetic';
    // context.globalAlpha = 1.0;


    // Azavea Logo    
    var logo = fs.readFileSync('cicero_light_sm.png');
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

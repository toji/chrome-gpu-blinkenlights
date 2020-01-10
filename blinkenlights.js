// Copyright 2020 Brandon Jones
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

let https = require('https');
let process = require('process');

let Blink1 = require('node-blink1');
let HTMLParser = require('node-html-parser');

const PING_URL = 'https://ci.chromium.org/p/chromium/g/chromium.gpu/console';
const PING_INTERVAL = 5; //min

const MS_PER_MINUTE = 60 * 1000;
const FADE_TIME = 500; //ms
const EMERGENCY_FADE_TIME = 1500; //ms

const COLOR_NONE = [0, 0, 0];
const COLOR_ERROR = [0, 0, 200];
const COLOR_FAILURE = [255, 0, 0];
const COLOR_EXCEPTION = [180, 0, 180];
const COLOR_EMERGENCY = [255, 255, 0];

let blink1;
try { 
  blink1 = new Blink1();
} catch(err) {
  console.log("No blink(1) found");
  process.exit(1);
}

let hairOnFire = false;
function declareEmergency() {
  hairOnFire = true;
  function weeOoo() {
    if (!hairOnFire) { return; }
    console.log('Hair Still on Fire!');
    console.log('Wee!');
    blink1.fadeToRGB(EMERGENCY_FADE_TIME, COLOR_EMERGENCY[0], COLOR_EMERGENCY[1], COLOR_EMERGENCY[2], () => {
      console.log('Ooo!');
      blink1.fadeToRGB(EMERGENCY_FADE_TIME, COLOR_NONE[0], COLOR_NONE[1], COLOR_NONE[2], weeOoo);
    });
  }
  weeOoo();
}

function setColor(color, message) {
  hairOnFire = false;
  if (message) {
    console.log(message);
  }
  try {
    blink1.fadeToRGB(FADE_TIME, color[0], color[1], color[2]);
  } catch(err) { 
    console.log(err); // Might get this if your USB port is weird/flaky
  }
}

console.log(`Watching ${PING_URL} every ${PING_INTERVAL} minute(s).`);

function refresh() {
  process.stdout.write(`Pinging... `);
  let req = https.request(PING_URL, (response) => {
    let str = '';
    response.on('data', function (chunk) {
      str += chunk;
    });

    response.on('end', function () {
      let root = HTMLParser.parse(str);
      if(!root) { return setColor(COLOR_ERROR, `Error Parsing HTML`); }

      let consoleBuilderColumns = root.querySelectorAll('.console-builder-column');
      if (!consoleBuilderColumns || !consoleBuilderColumns.length) {
        return setColor(COLOR_ERROR, `Could not find .console-builder-column`);
      }

      let successes = 0;
      let failures = 0;
      let exceptions = 0;
      let unknown = 0;

      for (column of consoleBuilderColumns) {
        if (column.querySelector('.console-Success')) {
          successes += 1;
        } else if (column.querySelector('.console-Failure')) {
          failures += 1;
        } else if (column.querySelector('.console-InfraFailure')) {
          exceptions += 1;
        } else {
          unknown += 1;
        }
      }

      let total = successes + failures + exceptions + unknown;

      console.log(`Done
Successful Builders: ${successes}
Failing Builders: ${failures}
Infra Failures: ${exceptions}
`);
      if (unknown) {
        console.log(`Unknown Builder States: ${unknown}`);
      }

      if (successes < total * 0.6) {
        // If 2/3rds of the tree is unsuccessful that, uh... calls for some blinking.
        declareEmergency();
      } else if (failures) {
        setColor(COLOR_FAILURE);
      } else if (exceptions) {
        setColor(COLOR_EXCEPTION);
      } else {
        setColor(COLOR_NONE);
      }
    });

    response.on('error', function () {
      setColor(COLOR_ERROR, `Error Fetching Page`);
    });
  });
  req.end();
}

// Pulse the light once to clear state and show that we're working.
blink1.fadeToRGB(FADE_TIME, 180, 180, 180, () => {
  blink1.fadeToRGB(FADE_TIME, 0, 0, 0, () => {
    refresh();
    setInterval(refresh, PING_INTERVAL * MS_PER_MINUTE );
  });
});


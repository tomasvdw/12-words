



/* Generic initialization */
$(function() {
    
  // check some browser support
  if (typeof($('input[type="file"]')[0].files) === 'undefined' 
      || !window.Worker
      || !window.Uint8Array
      )
  {
    $('body').html('<p>Your browser is to old for this service.' +
        'Please update your browser. Support is needed for ' +
        'Webworkers, File API and Typed Arrays and crypto.');
    return;
  }


  zip.workerScriptsPath = 'lib/';
  /*
   * use asm.js. seems unstable
   zip.workerScripts = {
      deflater: ['lib/z-worker.js', 'lib/zlib.js', 'lib/codecs.js'],
  };*/

  handleFileSelect(); // may have files remembered

  generatePassPhrase();
})


// ajaxify links
$(function() {
    $('nav a').click(function() {

        history.pushState({a:1}, undefined, this.href);
        setState();
        return false;
    })
    function setState(ev)
    {
        var nav = document.location.pathname.substr(1) || 'put';
        for(var k in {put:1,get:1,pay:1,faq:1})
        {
            $('form.'+k).toggle(nav == k);
            $('body').toggleClass(k, nav ==k);
        }
        $('textarea:visible').focus();

    }
    window.onpopstate = setState;
    setState();
})

function updateProgressTable(target, started, progress, bytes_done)
{


    var time_taken = (new Date() - started ) /1000;
    var speed = bytes_done / time_taken;

    var time_total = time_taken / progress;
    var eta = time_total - time_taken;
    if (progress == 0 | time_taken == 0) return;

    $('.speed',target).text(formatSize(speed)+'/s');
    $('.progr',target).text(rn(progress*100) + ' %');

    if (eta < 240)
        eta = Math.round(eta) + ' s';
    else if (eta < 60 * 120)
        eta = Math.round(eta/60) + 'm';
    else
        eta = Math.round(eta/3600) + 'h';
    $('.eta',target).text(eta);

    var p1 = (progress*100);
    var p2 = (progress*100)+3;
    if (p2>100) p2 = 100;
    $(target).css('background', 'linear-gradient(to right, #b8d5d9 0%,#b8d5d9 '+p1+'%,#c8e5e9 '+p2+'%, #ffffff '+p2+'%,#ffffff 100%)');
}


function setError(msg) {
  $('form:visible .error').text(msg).show();
}

$("textarea").keypress(function (e) {
  if(e.which == 13) {
    e.preventDefault();
    $(this).closest('form').submit();
  }
});



// Implement for IE10
if (!ArrayBuffer.prototype.slice) {
    //Returns a new ArrayBuffer whose contents are a copy of this ArrayBuffer's
    //bytes from `begin`, inclusive, up to `end`, exclusive
    ArrayBuffer.prototype.slice = function (begin, end) {
        //If `begin` is unspecified, Chrome assumes 0, so we do the same
        if (begin === void 0) {
            begin = 0;
        }

        //If `end` is unspecified, the new ArrayBuffer contains all
        //bytes from `begin` to the end of this ArrayBuffer.
        if (end === void 0) {
            end = this.byteLength;
        }

        //Chrome converts the values to integers via flooring
        begin = Math.floor(begin);
        end = Math.floor(end);

        //If either `begin` or `end` is negative, it refers to an
        //index from the end of the array, as opposed to from the beginning.
        if (begin < 0) {
            begin += this.byteLength;
        }
        if (end < 0) {
            end += this.byteLength;
        }

        //The range specified by the `begin` and `end` values is clamped to the 
        //valid index range for the current array.
        begin = Math.min(Math.max(0, begin), this.byteLength);
        end = Math.min(Math.max(0, end), this.byteLength);

        //If the computed length of the new ArrayBuffer would be negative, it 
        //is clamped to zero.
        if (end - begin <= 0) {
            return new ArrayBuffer(0);
        }

        var result = new ArrayBuffer(end - begin);
        var resultBytes = new Uint8Array(result);
        var sourceBytes = new Uint8Array(this, begin, end - begin);

        resultBytes.set(sourceBytes);

        return result;
    };
}


// Implement for IE10
if (!Uint8Array.prototype.slice) {
    //Returns a new ArrayBuffer whose contents are a copy of this ArrayBuffer's
    //bytes from `begin`, inclusive, up to `end`, exclusive
    Uint8Array.prototype.slice = function (begin, end) {
	return new Uint8Array(this.buffer.slice(begin,end));
    };
}



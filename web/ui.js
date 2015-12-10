



/* Generic initialization */
$(function() {
    
  // check some browser support
  if (typeof($('input[type="file"]')[0].files) === 'undefined' 
      || !window.Worker
      || !window.Uint8Array
      || !window.crypto)
  {
    $('body').html('<p>Your browser is too old for this site.' +
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


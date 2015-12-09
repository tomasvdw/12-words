



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
        $('form.put').toggle(nav == 'put');
        $('form.get').toggle(nav == 'get');
        $('form.pay').toggle(nav == 'pay');
        $('form.faq').toggle(nav == 'faq');
    }
    window.onpopstate = setState;
    setState();
})

$(function() {
    $('form.get').submit(function() {

        var file = getName($('#get_passphrase').val());
        var directDownload = 
            $('<a href="' + file + '" download>Direct download</a>');
        $('form.get').append($('<p>').append(directDownload));
        return false;
    })
})


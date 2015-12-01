

var WORDCOUNT = 12;
var COMPRESSION = 0;
var UPLOAD_SIZE = 1024 * 1024;
var MAX_QUEUE_LEN = 25;

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


// create filename from passphrase
function getName(phrase) {
  return '/f/'+CryptoJS.SHA256(phrase) + '.zip';
}

// create and show cryptographically secure phrase
function generatePassPhrase() {
  var s = new Uint16Array(WORDCOUNT);
  crypto.getRandomValues(s);
  var phrase_words = [];
  for(var n=0; n < WORDCOUNT; n++)
    phrase_words.push(words[s[n] & 0x7FF]);

  var phrase = phrase_words.join(' ');
  $('#put_passphrase').text(phrase);
}

// human readable size
function formatSize(s) {
  if (s < 1024)
    return s +' B';
  else if (s < 1024 * 1024)
    return Math.round(s/ (102.4)) /10 + ' KB';
  else if (s < 1024 * 1024 * 1024)
    return Math.round(s/ (1024 * 102.4)) /10 + ' MB';
  else
    return Math.round(s/ (1024 *1024 * 102.4)) /10 + ' GB';
}

/* Updates the table of files after a selection 
 * is made */
function handleFileSelect(evt) {
    var allfiles = $('#put_files')[0].files;

    // css to show table et al
    $('form.put').toggleClass('files_selected', allfiles.length>0);

    // files is a FileList of File objects. List some properties.
    var output = [];
    var total = 0;
    var last = 0;
    for (var i = 0, f; f = allfiles[i]; i++) {
      var row = '<tr>'
        + '<td class="n">' + f.name
        + '<td>' + formatSize(f.size)
        + '<td>' + f.lastModifiedDate.toLocaleString();

      total += f.size;
      if (f.lastModifiedDate > last)
        last = f.lastModifiedDate;
      output.push(row);
    }
    var foot = '';
    if (output.length > 1)
    {
        foot = '<tr><th>Total<th>' + formatSize(total) + '<th>' + 
            last.toLocaleString();
    }
    $('#put_filelist tbody').html(output.join('')+foot);
}

$('#put_files').on('change', handleFileSelect);

$('form.put').on('submit', function() {
    doUpload();
    return false;
});
    
function doUpload(evt) {

  $('body').addClass('uploading');
  var allfiles = $.makeArray($('#put_files')[0].files);
  var bytes_done = 0;
  var total_bytes = 0;
  for(var n=0; n < allfiles.length; n++)
      total_bytes += allfiles[n].size;

  function progress(done, total)
  {
      var progress = 100 * (bytes_done + done) / total_bytes;

      // can't be done while still uploading
      if (progress > 99.9) progress = 99.9;
      $('td.progress').text(Math.round(progress * 10)/10 + '%');
  }

  function complete() {
  }

  // use a zip.BlobWriter object to write zipped data into a Blob object
  zip.createWriter(new UploadWriter("application/zip"), function(zipWriter) 
  {
    function addfile()
    {
        var file = allfiles.shift();
        if (!file)
            zipWriter.close(complete);
        else
        {
            zipWriter.add(
                file.name, 
                new zip.BlobReader(file), function() {
                    bytes_done += file.size;
                    addfile();               
                }, 
                progress, 
                {level: COMPRESSION}
            );
        }
    }
    addfile();
  }, onerror);
}


// Handler passed to zip.js
// that will upload the zipped chunks of data to the server
function UploadWriter(contentType) {
    var that = this, data = "", pending = "";
    var zipped = 0;
    var uploaded = 0;
    var uploadrq;
    var dataqueue = [];
    var n=0;
    var started = new Date();
    var name = getName($('#put_passphrase').text());

    function init(callback) {
        console.log('Uploadwriter.init', callback);
        data += "data:" + (contentType || "") + ";base64,";
        callback();
    }

    // Called to when a new block to upload may be available
    function trigger_upload() {
        if (uploadrq)
            return; // still busy
        if (dataqueue.length === 0)
            return; // nothing to do

        uploadrq = new XMLHttpRequest();
        uploadrq.open('PUT', name);
        var current = dataqueue.shift();
        var current_length = current.length;
        uploadrq.send(current);
        uploadrq.onreadystatechange = function() {
            if (uploadrq.readyState == XMLHttpRequest.DONE)
            {
                console.log('done');
                uploadrq = 0;
                uploaded += current_length;
                console.log('Uploading; ', zipped, 
                            uploaded, dataqueue.length);
                trigger_upload();
            }
        }

    }

    function writeUint8Array(array, callback) {
        //console.log('Uploadwriter.writeUint8Array', array);
        if (array.length > 0)
        {
            zipped += array.length;
            if (++n % 10 == 0)
            {
                var sp = zipped / ((new Date() - started)/1000);
                $('.speed').text(formatSize(sp)+'/s');
            }
            dataqueue.push(array);
            trigger_upload();
        }
        function trycallback()
        {
            if (dataqueue.length > MAX_QUEUE_LEN)
                window.setTimeout(trycallback, 2000);
            else
                callback();
        }
        trycallback();
    }

    function getData(callback) {
        console.log('Uploadwriter.getdata', callback);
        callback('NA');
    }

    that.init = init;
    that.writeUint8Array = writeUint8Array;
    that.getData = getData;
}
UploadWriter.prototype = new zip.Writer();
UploadWriter.prototype.constructor = UploadWriter;







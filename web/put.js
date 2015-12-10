

var WORDCOUNT = 12;
var COMPRESSION = 1;
var UPLOAD_SIZE = 1024 * 1024;
var MAX_QUEUE_LEN = 25;


var upload_state = 
{
    started: 0,
    total_bytes: 0,
    compressed: 0,
    encrypted: 0,
    uploaded: 0,
}

var allfiles = [];

// create filename from passphrase
function getName(phrase) {
   var md = forge.md.sha256.create();
   md.update(phrase);
   return '/f/'+md.digest().toHex()+ '.zip';
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

function put_passphrase()
{
  return $('#put_passphrase').text();
}

// human readable size
function rn(r)
{
  r = ''+Math.round(r*10)/10;
  if (r.indexOf('.')==-1)
      return r +'.0';
  else
      return r;
}
function formatSize(s) {
  if (s < 1024)
    return Math.round(s) +' B';
  else if (s < 1024 * 1024)
    return rn(s/1024) + ' KB';
  else if (s < 1024 * 1024 * 1024)
    return rn(s/(1024*1024)) + ' MB';
  else
    return rn(s/(1024*1024*1024))+ ' GB';
}

/* Updates the table of files after a selection 
 * is made */
function handleFileSelect(evt) {
    for(var f=0; f < $('#put_files')[0].files.length; f++)
      allfiles.push($('#put_files')[0].files[f]);
    updateFileList();
}

function updateFileList() {

    // css to show table et al
    $('form.put').toggleClass('files_selected', allfiles.length>0);

    // files is a FileList of File objects. List some properties.
    var output = [];
    var total = 0;
    var last = 0;
    for (var i = 0, f; f = allfiles[i]; i++) {
      var row = '<tr>'
        + '<td class="n">' + f.name
        + '<td class="s">' + formatSize(f.size)
        + '<td class="s">' + f.lastModifiedDate.toLocaleString()
        + '<td class="s"><a class="rm" href="javascript:rm('+i+')">X</a>';

      total += f.size;
      if (f.lastModifiedDate > last)
        last = f.lastModifiedDate;
      output.push(row);
    }
    var foot = '';
    if (output.length > 1)
    {
        foot = '<tr><th class="n">Total<th class="s">' + 
            formatSize(total) + '<th class="s">' + 
            last.toLocaleString() + '<th>';
    }
    $('#put_filelist tbody').html(output.join('')+foot);

    if (allfiles.length == 0)
      $('body').removeClass('files_selected');
}

function rm(elm)
{
  allfiles.splice(elm,1);
  updateFileList();
}

$('#put_files').on('change', handleFileSelect);

$('form.put').on('submit', function() {
    doUpload();
    return false;
});
    
function doUpload(evt) {

  $('body').addClass('uploading');
  var bytes_done = 0;

  upload_state.started = new Date();
  for(var n=0; n < allfiles.length; n++)
      upload_state.total_bytes += allfiles[n].size;

  zipoptions.zip64 = upload_state.total_bytes > 0xFFFFFFFE;

  function progress(done, total, xx)
  {
      upload_state.compressed = bytes_done + done;
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


function updateProgress(state)
{
    var ratio = (upload_state.compressed/upload_state.encrypted);
    var progress = (upload_state.uploaded * ratio) 
        / upload_state.total_bytes;

    updateProgressTable(
        $('#put_progress .progress'),
        upload_state.started,
        progress,
        upload_state.total_bytes * progress);
}

function uploadDone() {
  $('body').addClass('uploading_done');
}

// Handler passed to zip.js
// that will upload the zipped chunks of data to the server
function UploadWriter(contentType) {
    var that = this, data = "", pending = "";
    var uploadrq;
    var dataqueue = [];
    var doneCalled = false;
    var n=0;
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
        {
            if (doneCalled)
                uploadDone();
            return; // nothing to do
        }

        uploadrq = new XMLHttpRequest();
        uploadrq.open('PUT', name);
        var current = dataqueue.shift();
        var current_length = current.length;
        uploadrq.overrideMimeType('text/plain');
        uploadrq.send(current);
        uploadrq.onreadystatechange = function() {
            if (uploadrq.readyState == XMLHttpRequest.DONE)
            {

                uploadrq = 0;
                upload_state.uploaded += current_length;
                upload_state.queue_length = dataqueue.length;
                updateProgress(upload_state);

                trigger_upload();
            }
        }

    }

    function writeUint8Array(array, callback) {

        upload_state.encrypted += array.length;

        if (array.length > 0)
        {
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
        callback('NA');
        doneCalled = true;
    }

    that.init = init;
    that.writeUint8Array = writeUint8Array;
    that.getData = getData;
}
UploadWriter.prototype = new zip.Writer();
UploadWriter.prototype.constructor = UploadWriter;







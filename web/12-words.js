
/* 12 words interface
 * no rights reserved */

// SETTINGS

var BTC_PUBKEY = 'xpub661MyMwAqRbcFs67oHz9iKpgyvkfY5jBH4UY4EL5VpRhpwDuMSqQp1Hkabh4jZLwTApNvAfPzqW9RcvjYgwnDZ1u6ie5AuQeaZTu6tgbViz';

var BASE_URL = 'https://s3-us-west-2.amazonaws.com/12-words-store/';

var BTC_CHECK_INTERVAL = 3000;
var MAX_METHOD2 = 512 * 1024 * 1024;

var WORDCOUNT = 12;
var COMPRESSION = 1;
var UPLOAD_SIZE = 5 * 1024 * 1024;
var MAX_QUEUE_LEN = 25;
var UPLOAD_AWS = true;
var AWS_BUCKET = '12-words-store';

var AWS_ACCESS_KEY = '';
var AWS_SECRET_ACCESS_KEY = '';

var AWS_REQUESTS = 6;


var PRICE_BASE = 0.005;
var PRICE_GB_MONTH = 0.001;


// diable logging by default
console.log = function() {};



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


    generatePassPhrase();
})


// ajaxify links
$(function() {
    $('nav a, a.internal').click(function() {

        history.pushState({a:1}, undefined, this.href);
        setState();
        return false;
    })
    function setState(ev)
    {
        var nav = document.location.pathname.substr(1) || 'put';
        for(var k in {put:1,get:1,keep:1,faq:1})
        {
            $('form.'+k).toggle(nav == k);
            $('body').toggleClass(k, nav ==k);
        }
        $('textarea:visible').focus();

        checkBalance();

    }
    window.onpopstate = setState;
    setState();
})

// Helper to fill in a progress table 
// at target, setting a background gradient as bar
function updateProgressTable(target, started, progress, bytes_done)
{
    // fill progress bar
    if (progress != 0)
    {
        var p1 = (progress*100)-3;
        var p2 = (progress*100);
        if (p1<0) p1 = 0;
        $(target).css('background', 'linear-gradient(to right, #b8d5d9 0%,#b8d5d9 '+p1+'%,#c8e5e9 '+p2+'%, #ffffff '+p2+'%,#ffffff 100%)');
    }

    if (bytes_done == 0) return;

    // calculate actual numbers to fill in
    var time_taken = (new Date() - started ) /1000;
    var speed = bytes_done / time_taken;

    var time_total = time_taken / progress;
    var eta = time_total - time_taken;


    if (eta < 240)
        eta = Math.round(eta) + ' s';
    else if (eta < 60 * 120)
        eta = Math.round(eta/60) + 'm';
    else
        eta = Math.round(eta/3600) + 'h';

    $('.speed',target).text(formatSize(speed)+'/s');
    $('.progr',target).text(rn(progress*100) + ' %');
    $('.eta',target).text(eta);

}

window.onerror = function(err)
{
    $('form:visible .error').text(err).show();
    window.clearInterval(window.progressTimer );
}

// Displays error on current tab
function setError(msg) {
    $('form:visible .error').text(msg).show();
    window.clearInterval(window.progressTimer );
}

// enter on textarea = submit
$(function() {
    $("textarea").keypress(function (e) {
        if(e.which == 13) {
            e.preventDefault();
            $(this).closest('form').submit();
        }
    });
});

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


// Polyfills for IE10
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


/***************************
 ****** GET ****************
 ***************************/ 


// Handle GET form submit

$(function() {
    $('form.get').submit(function() {

        // grab passphrase, normalize spaces
        // and convert to filename
        var file = BASE_URL + getName(get_passphrase());
        $('body').removeClass('get_notfound'); 

        var btn = $('input[type="submit"]', this);
        var busy = $('<p>Searching...</p>');
        btn.closest('p').after(busy);
        btn.hide();

        // see if the file exists
        $.ajax(file, {
            method: 'HEAD',
            success: function(res, status, xhr) { 
                $('body').removeClass('get_notfound'); 
                $('body').addClass('get_found'); 

                $('a#get_directdownload')[0].href = file;
                $('a#get_decrypt')[0].href = file;
                $('form.get textarea').prop('readonly',true);

                // check if method2 is possible
                var size = xhr.getResponseHeader("Content-Length");
                if (size > MAX_METHOD2)
                {
                    $('#get_method2').html(
                    '<p>The file is too large to decrypt in your browser');
                }
            },

            error: function() { 
                // file doesn't exist
                $('body').removeClass('get_found'); 
                $('body').addClass('get_notfound'); 
                busy.remove();
                btn.show();
            }
        });

        return false;
    })
});


// HANDLE start decrypt link
$(function() {
    $('a#get_decrypt').click(function() {
        console.log('Decrypting', this.href);
        var file = this.href;
        startDownload(file);

        return false;

    })

});

function get_passphrase()
{
    return $('#get_passphrase').val().replace(/\s+/g,' ').trim();
}

// begin downloading for in-browser-decryption
function startDownload(file)
{
    var started = new Date();

    $('body').addClass('get_downloading');

    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(){
        if (this.readyState == 4 && this.status == 200){

            $('body').removeClass('get_downloading');
            startDecrypt(this.response);
        }

    }
    xhr.onprogress = function(e) {

        progress = e.loaded / e.total;
        updateProgressTable(
                $('#get_downloading .progress'),
                started,
                progress,
                e.loaded);

    }

    xhr.open('GET', file);
    xhr.responseType = 'blob';
    xhr.overrideMimeType('application/octet-stream');
    xhr.send();   


}

// Called after downloading to perform decryption
function startDecrypt(blob)
{
    $('body').addClass('get_decrypting');
    var $t = $('#get_decrypting');

    zip.createReader(new zip.BlobReader(blob), function(zipReader) {
        zipReader.getEntries(function(entries) {
            console.log(entries);

            // create table of files
            for(var n=0; n < entries.length; n++) {
                var nm = $('<td class="n">').text(entries[n].filename);
                var sz = $('<td class="s">').text(formatSize(entries[n].uncompressedSize));

                // create a progress table for decryption
                entries[n].row = $('<table class="progress">').append($('<tr>')
                    .append(nm.clone())
                    .append(sz.clone())
                    .append('<td class="s speed">')
                    .append('<td class="s progr">')
                    .append('<td class="s eta">'));
                $('table', $t).append($('<tr>').append(nm).append(sz));
            }
            var count = 0;
            var started = new Date();

            
            function fileDone(data)
            {

                // create download link
                var tdname = $('td.n', entries[count].row);
                var name = tdname.text();
                tdname.text('');
                var anchor = $('<a></a>').text(name)[0];
                anchor.href = URL.createObjectURL(data);
                anchor.download = name;

                // IE10 special download handling
                if (navigator.msSaveOrOpenBlob)
                {
                    anchor.onclick = function() {
                        navigator.msSaveOrOpenBlob(data, name || "download")
                            return false;
                    }
                }

                $('ul', $t).append($('<li>').append(anchor));


                count++;
                if (count<entries.length)
                    decryptNext();
                else
                {
                    zipReader.close();
                    $('table.progress', $t).remove();
                    $('#get_decryptiondone').show();
                    $('#get_decrypting p').hide();
                }
            }
            var n=0;
            function fileProgress(data)
            {
                if (n++ % 50 == 0)
                {
                    updateProgressTable(entries[count].row,
                            started, data / entries[count].compressedSize, data);
                }
            }

            function decryptNext()
            {
                $('table.files tr:eq()', $t).remove();

                $('table.progress', $t).remove();
                $('ul', $t).after(entries[count].row);


                entries[count].getData(new zip.BlobWriter(),
                        fileDone,
                        fileProgress);
            }
            decryptNext();
        });
    }, onerror);

}



/***************************
 ****** PUT ****************
 ***************************/ 


var allfiles = [];

/* Drag drop support */
$(function() {
    $('html').on(
        'dragover',
        function(e) {
            e.preventDefault();
            e.stopPropagation();
        }
    )
    $('html').on(
        'dragenter',
        function(e) {
            e.preventDefault();
            e.stopPropagation();
        }
    )

    $('html').on(
        'drop',
        function(e){
            if(e.originalEvent.dataTransfer){
                if(e.originalEvent.dataTransfer.files.length) {
                
                    e.preventDefault();
                    e.stopPropagation();
                    var lst = e.originalEvent.dataTransfer.files;
                    for (var f=0; f < lst.length; f++)
                    { console.log(lst, 'l=', lst[f]);
                        allfiles.push(lst[f]);}
                    updateFileList();
                }   
            }
        }
    );
});

// create filename from passphrase
function getName(phrase) {
    var md = forge.md.sha256.create();
    for(var n=0; n <100; n++)
        md.update(phrase);
    return md.digest().toHex()+ '.zip';
}

// create and show cryptographically secure phrase
function generatePassPhrase() {

    var s = new Uint16Array(WORDCOUNT);
    var phrase_words = [];

    var bytes = forge.random.getBytesSync(2*WORDCOUNT);
    for(var n=0; n < WORDCOUNT; n++)
    {
        var idx = (bytes.charCodeAt(n*2) & 0x7) << 8;
        idx = idx | bytes.charCodeAt(n*2+1) & 0xFF;

        phrase_words.push(words[idx]);
    }

    var phrase = phrase_words.join(' ');
    $('#put_passphrase').text(phrase);
}

function put_passphrase()
{
    return $('#put_passphrase').text();
}


/* Updates the table of files after a selection 
 * is made */
function handleFileSelect(evt) {
    for(var f=0; f < $('#put_files')[0].files.length; f++)
        allfiles.push($('#put_files')[0].files[f]);
    updateFileList();
}

function updateFileList() {
    // dedup file list
    for(var i = 0; i < allfiles.length; i++)
    {
        for(var j = i+1; j < allfiles.length; j++)
            if (allfiles[i] && allfiles[j] &&
                    allfiles[i].name.toLowerCase() === 
                    allfiles[j].name.toLowerCase())
            {
                allfiles.splice(i,1);
            }
    }

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

// remove a row from uploaded files
function rm(elm)
{
    allfiles.splice(elm,1);
    updateFileList();
}

$(function() {
    $('#put_files').on('change', handleFileSelect);

    $('form.put').on('submit', function() {
        doUpload();
        return false;
    });
});

// start actual upload
function doUpload(evt) {

    $('body').addClass('uploading');
    var bytes_done = 0;

    upload_state.started = new Date();
    for(var n=0; n < allfiles.length; n++)
        upload_state.total_bytes += allfiles[n].size;

    startUploadProgress();
    zipoptions.zip64 = upload_state.total_bytes > 0xFFFFFFFE;

    function progress(done, total, xx)
    {
        upload_state.compressed = bytes_done + done;
    }

    function complete() {
    }

    var uploader;
    if (UPLOAD_AWS)
        uploader = new AwsUploadWriter("application/zip");
    else
        uploader = new UploadWriter("application/zip");

    // use the upload writer as destination for the zip-stream
    zip.createWriter(uploader, function(zipWriter) 
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

var upload_state = 
{
    started: 0,
    upload_started: 0,
    total_bytes: 0,
    compressed: 0,
    encrypted: 0,
    uploaded: 0,

}

function startUploadProgress()
{
    var speed = 768 * 1024; // assume 768kb/sec

    var init_time = 2;
    var upload_time = upload_state.total_bytes / speed;

    var started = upload_state.started.getTime()/1000;

    upload_state.est_end = started + upload_time + init_time;
    
    var cur_progress = 0;
    var timer = 0.6;


    window.progressTimer = window.setInterval(function() {

        
        var now = (new Date()).getTime() / 1000;

        var needed = upload_state.est_end - now;
        if (needed < 2) needed = 2;
        cur_progress += (1-cur_progress) * (timer/needed);





        /*console.log('speed=', speed, 'adjusted_speed=', adjusted_speed,
          'bytes_done=', bytes_done, 'est_bytes_done=', est_bytes_done);
          */
        updateProgressTable(
                $('#put_progress .progress'),
                0,
                cur_progress,
                0); 

        var eta = needed;
        if (eta < 240)
            eta = Math.round(eta) + ' s';
        else if (eta < 60 * 120)
            eta = Math.round(eta/60) + 'm';
        else
            eta = Math.round(eta/3600) + 'h';

        $('#put_progress .eta').text(eta);
        if (upload_state.speed)
        {
            $('#put_progress .eta').text(eta);
            $('#put_progress .progr').text(rn(cur_progress*100) + ' %');
            $('#put_progress .speed').text(formatSize(
                        upload_state.speed)+'/s');
        }


    }, timer * 1000);
}


function updateProgress(state)
{
    // incoming data, adjust speed
    var ratio = (upload_state.compressed/upload_state.encrypted);
    var now = (new Date()).getTime() / 1000;
    var up_started = upload_state.upload_started.getTime() / 1000;
    upload_state.speed = (upload_state.uploaded * ratio) 
        / (now - up_started);

    var todo = upload_state.total_bytes - (upload_state.uploaded * ratio);
    upload_state.est_end = now + (todo / upload_state.speed);


    console.log('EST-SPEED=', upload_state.speed, 'EST-TODO=', 
            upload_state.est_end - now);
    return;


    updateProgressTable(
            $('#put_progress .progress'),
            upload_state.upload_started,
            progress,
            upload_state.total_bytes * progress);
}

function uploadDone() {
    $('body').addClass('uploading_done');

    $('form.keep textarea').text(put_passphrase());
    $('form.keep').submit();

    window.clearInterval(window.progressTimer);
}

// Handler passed to zip.js
// that will upload the zipped chunks of data to the server
function UploadWriter(contentType) {
    var that = this, data = "", pending = "";
    var uploadrq;
    var dataqueue = [];
    var doneCalled = false;
    var n=0;
    var name = '/f/' + getName($('#put_passphrase').text());

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




// Handler passed to zip.js
// that will upload the zipped chunks of data to AWS
function AwsUploadWriter(contentType) {

    var name = getName($('#put_passphrase').text());

    var aws_params = {
        Bucket: AWS_BUCKET,
        Key: name
    }

    var aws_part_counter = 0;
    var aws_parts = [];

    var that = this;
    var uploads_active = 0;

    var dataqueue = [];
    var doneCalled = false;

    function init(callback) {

        console.log('Uploadwriter.init', callback);

        // Start multipart upload to S3
        s3 = new AWS.S3({
            accessKeyId: AWS_ACCESS_KEY,
            secretAccessKey: AWS_SECRET_ACCESS_KEY,
        });

        s3.createMultipartUpload(aws_params, function(err, data) {
            if (err) setError('Error starting upload: ' + err);
            else 
            {    
                console.log('initiated S3 upload', data);
                aws_params.UploadId = data.UploadId;
                callback();
            }
        });
    }



    // complete the multipart upload
    function finishUpload()
    {
        aws_params.MultipartUpload = {
            Parts: aws_parts 
        };
        console.log('Completing...', aws_parts);

        s3.completeMultipartUpload(aws_params, function(err, data) {
            if (err) setError('Error completing upload: ' + err);
            else 
            {    
                uploadDone();
            }
        });
    }

    // Called to when a new block to upload may be available
    function trigger_upload() {

        if (uploads_active >= AWS_REQUESTS)
            return; // still too busy uploading


        if (dataqueue.length === 0)
        {
            if (doneCalled && uploads_active === 0)
                finishUpload();

            return; // nothing to do
        }

        if (!doneCalled && dataqueue[0].length < UPLOAD_SIZE)
        {
            return; //block is not yet not long enough
        }

        var current = dataqueue.shift();
        console.log('Uploading..', current, current.length);

        if (!upload_state.upload_started)
            upload_state.upload_started = new Date();


        aws_part_counter++;
        do_upload_part(current, aws_part_counter);

    }

    function do_upload_part(datablock, partnr)
    {
        var params = $.extend({}, aws_params, {
            PartNumber: partnr,
            Body: datablock,
            ContentLength: datablock.length
        });

        uploads_active++;

        s3.uploadPart(params, function(err, data) {
            uploads_active--;
            if (err) setError('Error uploading part: '+ err);
            else 
            {    
                console.log('uploaded', data);
                console.log('this=', this);

                aws_parts[partnr-1] = { 
                    ETag: data.ETag,
                    PartNumber: partnr
                };

                upload_state.uploaded += datablock.length;
                upload_state.queue_length = dataqueue.length;
                updateProgress(upload_state);
                trigger_upload();
            }
        });
    }


    // called when new data arives
    function writeUint8Array(array, callback) {

        upload_state.encrypted += array.length;

        if (array.length > 0)
        {
            // logic to make dataqueue items UPLOAD_SIZE long
            var n = dataqueue.length-1;
            if (n<0 || dataqueue[n].length === UPLOAD_SIZE)
            {
                dataqueue.push(array); // start new block
            }
            else if (dataqueue[n].length + array.length <= UPLOAD_SIZE)
            {
                // append too block
                var q = dataqueue[n];
                dataqueue[n] = new Uint8Array(dataqueue[n].length + array.length);
                dataqueue[n].set(q,0);
                dataqueue[n].set(array, q.length);
            }
            else
            {
                // append + start new
                var needed_bytes = UPLOAD_SIZE - dataqueue[n].length;
                var q = dataqueue[n];
                var new1 = array.slice(0, needed_bytes);
                var new2 = array.slice(needed_bytes);
                dataqueue[n] = new Uint8Array(UPLOAD_SIZE);
                dataqueue[n].set(q,0);
                dataqueue[n].set(new1,q.length);
                dataqueue.push(new2);
            }
            trigger_upload();
        }

        // we only callback when we're not too busy
        // otherwise we wait to prevent too much mem usage
        function trycallback()
        {
            if (dataqueue.length > MAX_QUEUE_LEN)
                window.setTimeout(trycallback, 2000);
            else
                callback();
        }
        trycallback();
    }

    // not sure why, but this seems the only
    // proper "finalize" callback
    function getData(callback) {
        console.log('AWS done triggered');
        doneCalled = true;
        trigger_upload();
        callback('NA');
    }

    that.init = init;
    that.writeUint8Array = writeUint8Array;
    that.getData = getData;
}
AwsUploadWriter.prototype = new zip.Writer();
AwsUploadWriter.prototype.constructor = AwsUploadWriter;


/***************************
 ****** KEEP ****************
 ***************************/ 


var keep = {};


$(function() {
    $('form.keep').submit(function() {

        // grab passphrase, normalize spaces
        // and convert to filename
        keep.name = getName(keep_passphrase());
        var file = BASE_URL + keep.name;

        $('body').removeClass('keep_notfound'); 
        var btn = $('input[type="submit"]', this);
        var busy = $('<p>Searching...</p>');
        btn.closest('p').after(busy);
        btn.hide();

        // see if the file exists
        $.ajax(file, {
            method: 'HEAD',
            success: function(res, status, xhr) { 
                $('body').removeClass('keep_notfound'); 
                $('body').addClass('keep_found'); 

                $('form.keep textarea').prop('readonly',true);

                keep.address = name2address(keep.name);
                checkBalance();


                keep.size = xhr.getResponseHeader("Content-Length");
                keep.date = xhr.getResponseHeader("Last-Modified");
                console.log('Found', keep);
            },

            error: function() { 
                $('body').removeClass('keep_found'); 
                $('body').addClass('keep_notfound'); 
                busy.remove();
                btn.show();
            }
        });

        return false;
    })

})

function keep_passphrase()
{
    return $('#keep_passphrase').val().replace(/\s+/g,' ').trim();
}


function checkBalance()
{
    if (!$('form.keep').is(':visible'))
        return;

    if (!keep.address)
        return;

    $.ajax('https://api.smartbit.com.au/v1/blockchain/address/' + keep.address, {
            success: function(data) {
                var recv = parseFloat(data.address.total.received);
                if (!('received' in keep) || recv != keep.received)
                {
                    keep.received = recv;
                    updateRetention();


                }
                window.setTimeout(checkBalance, BTC_CHECK_INTERVAL);
            }
            });
}

function calculateEndDate()
{
    var gb = Math.ceil(keep.size / (1024 * 1024 * 1024));
    keep.gb = gb;
    var dt = new Date(keep.date);
    dt.setHours(dt.getHours()+12); // 12 hours free

    if (keep.received > PRICE_BASE)
    {
        var months_payed = (keep.received - PRICE_BASE) / (PRICE_GB_MONTH * gb);
        dt.setMonth(dt.getMonth()+months_payed);
    }

    keep.enddate = dt;
}

function updateRetention()
{
    console.log('RECV:', keep.received);
    $('#keep_searching').hide();
    var $t = $('#keep_retention');
    if (keep.received - PRICE_BASE <= 0)
    {
        $('.pm', $t).text('No extra retention has been bought.');
        $('.pm_a', $t).text('');
    }
    else
    {
        $('.pm', $t).text('Payments found:');
        $('.pm_a', $t).text(Math.round(keep.received*1000) + ' mBTC');
    }

    calculateEndDate();
    var dates = keep.enddate.toLocaleDateString() + ' ' + keep.enddate.toLocaleTimeString()

    $('.ed_a', $t).text(dates);

    var base = '';
    if (keep.received < PRICE_BASE)
        base = Math.round((PRICE_BASE-keep.received)*1000) + 'mBTC + ';

    $('.er_a', $t).text( base + (PRICE_GB_MONTH * 1000) + 'mBTC/GB/month');


    //t.append('<div id="keep_address"></div>');
    //t.append('<div id="keep_qr"></div>');


    $t.show();
    updateQR();

}

$(function() {
    $('#keep_months').on('change', updateQR);
})

function updateQR()
{
    var $t = $('#keep_retention');
    var a =0;
    if (keep.received < PRICE_BASE)
        a = PRICE_BASE - keep.received;
    a += keep.gb * PRICE_GB_MONTH * parseInt($('#keep_months').val());

    $('.pr_a', $t).text( Math.round(a*1000) +' mBTC');
    $('pre',$t).text(keep.address);
    $('.qr', $t).empty();


    a = Math.round(a*1000)/1000;
    var qrcode = new QRCode($('.qr', $t)[0], {
        text: 'bitcoin:' + keep.address +'?message=12+Words+file+retention&amount='+a,
        width:192,
        height:192});
}

function name2address(name)
{
    var hdnode = bjs.bitcoin.HDNode.fromBase58(BTC_PUBKEY);
    var n1 = parseInt(name.substr(0,8), 16) & 0x7FFFFFFF;
    var n2 = parseInt(name.substr(8,8), 16) & 0x7FFFFFFF;

    return hdnode.derive(n1).derive(n2).keyPair.getAddress();
}


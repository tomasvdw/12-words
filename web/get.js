
var MAX_METHOD2 = 1024 * 1024 * 1024;

$(function() {
    $('form.get').submit(function() {
        // grab passphrase, normalize spaces
        // and convert to filename
        var file = getName(get_passphrase());


        // see if the file exists
        $.ajax(file, {
            method: 'HEAD',
            success: function(res, status, xhr) { 
                $('body').removeClass('get_notfound'); 
                $('body').addClass('get_found'); 

                $('a#get_directdownload')[0].href = file;
                $('a#get_decrypt')[0].href = file;
                $('textarea').prop('disabled',true);

                var size = xhr.getResponseHeader("Content-Length");
                if (size > MAX_METHOD2)
                    $('#get_method2').html('<p>The file is to large to decrypt in your browser');
            },

            error: function() { 
                $('body').removeClass('get_found'); 
                $('body').addClass('get_notfound'); 
            }
        });

        return false;
    })

    $('a#get_decrypt').click(function() {
      console.log('Decrypting', this.href);
      var file = this.href;
      startDownload(file);
        

        return false;

    })
})

function get_passphrase()
{
  return $('#get_passphrase').val().replace(/\s+/g,' ').trim();
}

function startDownload(file)
{
  var started = new Date();

  $('body').addClass('get_downloading');

  // see if the file exists
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
  xhr.overrideMimeType('text/plain');
  xhr.send();   


}

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

                entries[n].row = $('<table>').append($('<tbody>').append($('<tr>')
                      .append(nm)
                      .append(sz)
                      .append('<td class="s speed">')
                      .append('<td class="s progr">')
                      .append('<td class="s eta">')));
                $t.append(entries[n].row);
            }
            var count = 0;
            var started = new Date();

            function fileDone(data)
            {

                var tdname = $('td.n', entries[count].row);
                var name = tdname.text();
                tdname.text('');
                var anchor = $('<a></a>').text(name)[0];
                anchor.href = URL.createObjectURL(data);
                anchor.download = name;

                tdname.append(anchor);

                $('td.progr', entries[count].row).attr('colspan','3').text('done');
                $('td.eta', entries[count].row).remove();
                $('td.speed', entries[count].row).remove();

                count++;
                if (count<entries.length)
                    decryptNext();
                else
                {
                    zipReader.close();
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
                entries[count].getData(new zip.BlobWriter(),
                            fileDone,
                            fileProgress);
            }
            decryptNext();
        });
    }, onerror);

}

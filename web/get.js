
$(function() {
    $('form.get').submit(function() {
        // grab passphrase, normalize spaces
        // and convert to filename
        var file = getName($('#get_passphrase').val()
                .replace(/\s+/g,' '));


        // see if the file exists
        $.ajax(file, {
            method: 'HEAD',
            success: function() { 
                $('body').removeClass('get_notfound'); 
                $('body').addClass('get_found'); 

                $('a#get_directdownload')[0].href = file;
                $('a#get_decrypt')[0].href = file;
            },

            error: function() { 
                $('body').removeClass('get_found'); 
                $('body').addClass('get_notfound'); 
            }
        });

        /*
        var directDownload = 
            $('<a href="' + file + '" download>Direct download</a>');
        $('form.get').append($('<p>').append(directDownload));
        */
        return false;
    })

    $('a#get_decrypt').click(function() {

        return false;

    })
})

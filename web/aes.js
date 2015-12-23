/*
 * Plumbing between Zip.JS and Forge.
 * Acts as a reader/writer for zip.js
 * Uses forge for actual encryption
 */



function AesWriter(innerWriter)
{
  var that = this;
  var started = false;

  var salt;

  // derived from pw+salt
  var key;
  var maciv;
  var pwverify;

  var forgeAes;
  var forgeSha1;


  function initAes()
  {
    // random salt
    salt = forge.random.getBytesSync(16); 
    console.log('salt', salt);

    // extract pw
    var pw = put_passphrase();

    // transform pw + salt => key + mac initial value + verify code
    var forgeKey = forge.pkcs5.pbkdf2(pw,
            salt, 1000, 32 + 32 + 2 + 10);

    key      = forgeKey.substr(0,32);
    maciv    = forgeKey.substr(32,32);
    pwverify = forgeKey.substr(64, 2);

    console.log('key', string2Uint8(forgeKey.substr(0,32)).array);
    console.log('maciv', string2Uint8(forgeKey.substr(32,32)).array);
    console.log('pwverify', string2Uint8(forgeKey.substr(64,2)).array);

    // Initial counter for CTR nide
    var iv1 = getDataHelper(16);
    for(var v=0; v < 16; v++)
      iv1.view.setUint8(v,0);
    iv1.view.setUint8(0,1);

    forgeAes = forge.cipher.createCipher('AES-CTR', key);
    forgeAes.start({iv: forge.util.createBuffer(iv1.array)});

    forgeSha1 = forge.hmac.create();
    forgeSha1.start('sha1', maciv);

  }

  function init(callback) {
    console.log('AesWriter.init');
    innerWriter.init(callback);
  }

  function finalize()
  {

    forgeAes.finish();

    forgeSha1.update(forgeAes.output.data);

    // remaining encrypted bytes
    var last_batch = string2Uint8(forgeAes.output.data);
    innerWriter.writeUint8Array(last_batch.array , function() {});

    // add first 10 bytes of SHA1 hash as authentication code
    var auth_code = string2Uint8(forgeSha1.digest().data.substr(0, 10));
    innerWriter.writeUint8Array(auth_code.array , function() {});

  }

  function writeUint8Array(array, callback) {
    if (!started)
    {
      initAes(); 
      console.log('initiing');

      // write header
      innerWriter.writeUint8Array(string2Uint8(salt).array, function() {});
      innerWriter.writeUint8Array(string2Uint8(pwverify).array, function() {});

      started = true;
    }

    forgeAes.update(forge.util.createBuffer(array));

    var s= forgeAes.output.data;
    var arr = string2Uint8(s);

    forgeSha1.update(forgeAes.output.data);
    
    forgeAes.output.clear();


    innerWriter.writeUint8Array(arr.array , callback);
  }

  function getData(callback) {
    console.log('AesWriter.getData');
  }

  that.init = init;
  that.writeUint8Array = writeUint8Array;
  that.getData = getData;
  that.finalize = finalize;
}
AesWriter.prototype = new zip.Writer();
AesWriter.prototype.constructor = AesWriter;



function string2Uint8(s)
{
    var arr = getDataHelper(s.length);
    for(var n=0; n < s.length; n++)
        arr.view.setUint8(n, s.charCodeAt(n));
    return arr;
}



function getDataHelper(byteLength, bytes) {
  var dataBuffer, dataArray;
  dataBuffer = new ArrayBuffer(byteLength);
  dataArray = new Uint8Array(dataBuffer);
  if (bytes)
    dataArray.set(bytes, 0);
  return {
    buffer : dataBuffer,
    array : dataArray,
    view : new DataView(dataBuffer)
  };
}

function AesReader(innerReader, size) {
    var that = this;

    var started = false;
    
    var forgeAes;
    var forgeSha1;
    var done = 0;

    function init(callback) {
        that.size = innerReader.size;
        callback();
    }

    function initAes(arr)
    {
        var pw = get_passphrase();

        var salt = arr.slice(0,16);
        var cpwverify = arr.slice(16,2);

        // setup key iv and pwverify
        var forgeKey = forge.pkcs5.pbkdf2(
                pw,
                forge.util.createBuffer(salt).data, 
                1000, 32 + 32 + 2 + 10);

        key      = forgeKey.substr(0,32);
        maciv    = forgeKey.substr(32,32);
        pwverify = forgeKey.substr(64, 2);

        console.log('key', string2Uint8(forgeKey.substr(0,32)).array);
        console.log('maciv', string2Uint8(forgeKey.substr(32,32)).array);
        console.log('pwverify', string2Uint8(forgeKey.substr(64,2)).array);
        
        // Initial counter for CTR nide
        var iv1 = getDataHelper(16);
        iv1.view.setUint8(0,1);

        forgeAes = forge.cipher.createDecipher('AES-CTR', key);
        forgeAes.start({iv: forge.util.createBuffer(iv1.array)});

        forgeSha1 = forge.hmac.create();
        forgeSha1.start('sha1', maciv);
    }

    function readUint8Array(index, length, callback, onerror) {
        function decrypt(arr)
        {
            if (!started)
            {
                initAes(arr);
                arr = arr.slice(18);
                done += 18;
                started = true;

            }


            // last 10 bytes are meta
            if (done + arr.length > size - 10)
            {
                arr = arr.slice(0,
                        size - 10 - done);
            }

            done += arr.length;

            forgeAes.update(forge.util.createBuffer(arr));
            var s= forgeAes.output.data;
            var arr = string2Uint8(s);
            forgeSha1.update(forgeAes.output.data);
            
            forgeAes.output.clear();

            callback(arr.array);
            

        }
        innerReader.readUint8Array(index, length, decrypt, onerror);

    }

    that.size = 0;
    that.init = init;
    that.readUint8Array = readUint8Array;
}
AesReader.prototype = new AesReader();
AesReader.prototype.constructor = AesReader;

function string2Uint8(s)
{
    var arr = getDataHelper(s.length);
    for(var n=0; n < s.length; n++)
        arr.view.setUint8(n, s.charCodeAt(n));
    return arr;
}


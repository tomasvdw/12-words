


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
    // fake salt
    salt = getDataHelper(16);
    for(var n = 0; n < 16; n ++)
      salt.view.setUint8(n, 0x08);

    // fake pw
    var pw = "plok flok";

    // transform pw + salt => key + mac initial value + verify code
    var forgeKey = forge.pkcs5.pbkdf2(pw,
            forge.util.createBuffer(salt.array).data, 1000, 32 + 32 + 2 + 10);

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
      innerWriter.writeUint8Array(salt.array, function() {});
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

function words2Array(wordarray, byte_idx, bytes)
{
  function getbyte(wordarray, byte_idx)
  {
    return (wordarray[byte_idx >>2] >> (8*((3-byte_idx) & 3))) & 0xFF;
  }
  var result = getDataHelper(bytes);
  for(var v = byte_idx; v < byte_idx+bytes; v++)
    result.view.setUint8(v-byte_idx, getbyte(wordarray, v));

  return result;

}

function w2a(wordarray)
{
  if (!wordarray)
    return getDataHelper(0).array;
  else
    return words2Array(wordarray.words, 0, wordarray.sigBytes).array;
}

function w2h(wordarray)
{
  var res = '';
  var a = w2a(wordarray);
  for(var n=0; n < a.length; n++)
  {
    if (a[n] < 16)
      res+='0';
    res += a[n].toString(16);
  }
  return res;
}

function a2h(array)
{
  var wordarray ={
    words: array,
    sigBytes: 16
  };
  return w2h(wordarray);
}


function incr_counter(x)
{
  for(var n=0; n < 4; n++)
  {
    if (x[n] < 0) x[n] = 0x100000000+ x[n];
    if ((x[n] & 0xFF000000)>>>0 < 0xFF000000) {
      x[n] += 0x01000000;
      return;
    }
    x[n] -= 0xFF000000;

    if ((x[n] & 0xFF0000)>>>0 < 0xFF0000) {
      x[n] += 0x00010000;
      return;
    }
    x[n] -= 0x00FF0000;

    if ((x[n] & 0xFF00)>>>0 < 0xFF00) {
      x[n] += 0x000100;
      return;
    }
    x[n] -= 0x00FF00;

    if ((x[n] & 0xFF)>>>0 < 0xFF) {
      x[n] += 0x0001;
      return;
    }
    x[n] -= 0x00FF;
  }
}

function string2Uint8(s)
{
    var arr = getDataHelper(s.length);
    for(var n=0; n < s.length; n++)
        arr.view.setUint8(n, s.charCodeAt(n));
    return arr;
}
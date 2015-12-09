
  zip.workerScriptsPath = 'lib/';


$(function() {
    console.log('testing zip');
});

var TEXT_CONTENT = "AAAAAA";
var FILENAME = "BBBBBB";
var blob;

function onerror(message) {
	console.error(message);
}

function zipBlob(blob, callback) {
	zip.createWriter(new zip.BlobWriter("application/zip"), function(zipWriter) {
		zipWriter.add(FILENAME, new zip.BlobReader(blob), function() {
			zipWriter.close(callback);
		}, undefined, {level:1, version: 45 });
	}, onerror);
}

function unzipBlob(blob, callback) {
    dumpZip(blob);
	zip.createReader(new zip.BlobReader(blob), function(zipReader) {
		zipReader.getEntries(function(entries) {
			entries[0].getData(new zip.BlobWriter('text/plain'), function(data) {
				zipReader.close();
				callback(data);
			});
		});
	}, onerror);
}

function logBlobText(blob) {
	var reader = new FileReader();
	reader.onload = function(e) {
		console.log(e.target.result);
		console.log("--------------");
	};
	reader.readAsText(blob);
}

/*
blob = new Blob([ TEXT_CONTENT ], {
	type : 'text/plain'
});
logBlobText(blob);
zipBlob(blob, function(zippedBlob) {
	unzipBlob(zippedBlob, function(unzippedBlob) {
		logBlobText(unzippedBlob);
	});
});
*/
function dumpZip(blob)
{
    window.blob = blob;
    var rd = new FileReader();
    rd.onload = function() {
        var buf = this.result;
        var vw = new DataView(buf);
        console.log(vw);
        console.log(vw.getInt32(0).toString(16));
        var s= '';
        for(var n=0; n < vw.byteLength; n++)
        {
            if (n % 16 == 0) s += '\n';
            var hx = vw.getUint8(n);
            if (hx < 16) s+= '0';
            s += hx.toString(16) +' ';
        }
        console.log(s);

    }
    rd.readAsArrayBuffer(blob);

}

var input = getDataHelper(6);
input.view.setUint8(0, 0x73);
input.view.setUint8(1, 0x74);
input.view.setUint8(2, 0x04);
input.view.setUint8(3, 0x01);
input.view.setUint8(4, 0x2e);
input.view.setUint8(5, 0x00);

var salt = getDataHelper(16);
for(var n = 0; n < 16; n ++)
   salt.view.setUint8(n, 0x08);

var pw = "plok flok";

//var key = CryptoJS.enc.Hex.parse('000102030405060708090a0b0c0d0e0f');
//var iv  = CryptoJS.enc.Hex.parse('101112131415161718191a1b1c1d1e1f');
var test2= "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
salt = CryptoJS.lib.WordArray.create(salt.array);

var key256 = CryptoJS.PBKDF2(pw, salt, {keySize: 2 * 256/32 + 1, iterations: 1000});


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
    return words2Array(wordarray.words, 0, wordarray.sigBytes).array;
}
console.log('Pass verify:');


var _key = words2Array(key256.words, 0, 32);
var _maciv = words2Array(key256.words, 32, 32);
var _pw = words2Array(key256.words, 64, 2);

console.log('key', words2Array(key256.words, 0, 32).array);
console.log('iv', words2Array(key256.words, 32, 32).array);
console.log('PW verify', words2Array(key256.words, 64, 2).array);

var inputw = CryptoJS.lib.WordArray.create(input.array);

var iv1 = getDataHelper(16);
for(var v=0; v < 16; v++)
    iv1.view.setUint8(v,0);
iv1.view.setUint8(0,1);



var aesEncryptor = CryptoJS.algo.AES.createEncryptor(
    CryptoJS.lib.WordArray.create(_key.array), 
    {  iv: CryptoJS.lib.WordArray.create(iv1.array),
        mode: CryptoJS.mode.CTR, 
        padding: CryptoJS.pad.NoPadding
      });

var ciphertextPart1 = aesEncryptor.process(test2);
var ciphertextPart2 = aesEncryptor.finalize();
    
console.log('RESULT = ',CryptoJS.enc.Hex.stringify(ciphertextPart1));
console.log('RESULT = ',CryptoJS.enc.Hex.stringify(ciphertextPart2));



/*
// SALT == 16 x 08
// key = plok flok
//
//  pW verification = e0 d8
//
// output = e7 d2 eb a4 6c 8d
// auth code = b1 ff ea dd e0 3c 5b aa 80  6a

//var ciphertextPart1 = aesEncryptor.process("Message Part 1");
    
//var jsonObj = {
//   ct: cipherParams.ciphertext.toString(CryptoJS.enc.Base64)
//
*/



console.log('Testing forge AES');
var cipher = forge.cipher.createCipher('AES-CTR', 
   forge.util.createBuffer(_key.array));
cipher.start({iv: forge.util.createBuffer(iv1.array)});
cipher.update(forge.util.createBuffer(test2));
console.log(cipher.output.toHex());
cipher.finish();
console.log('FORGE', cipher.output.toHex());


var mac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA1, 
        CryptoJS.lib.WordArray.create(_maciv.array));
mac.update(ciphertextPart2);
var hash = mac.finalize();

console.log('CryptoJS', CryptoJS.enc.Hex.stringify(hash));

var hmac = forge.hmac.create();
hmac.start('sha1', forge.util.createBuffer(_maciv.array));
hmac.update(forge.util.createBuffer(w2a(ciphertextPart2)).data);
console.log('FORGE',hmac.digest().toHex());

var shaObj = new jsSHA('SHA-1', "HEX");
shaObj.setHMACKey(w2h(CryptoJS.lib.WordArray.create(_maciv.array)), "HEX");
shaObj.update(CryptoJS.enc.Hex.stringify(ciphertextPart2));
var hmac = shaObj.getHMAC("HEX");
console.log('jsSHA', hmac);

console.log('test incr');

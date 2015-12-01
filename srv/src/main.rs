// Server for filetransferencrypted

// serves localfiles from ../web
// and PUT and GET requests to store and retrieve
// encrypted ZIPs

extern crate hyper;

use hyper::server::{Request, Response};
use hyper::method::*;
use std::fs::File;
use std::io;
use std::io::*;
use std::fs::OpenOptions;

const WEB_PATH : &'static str = "../web";
const ZIP_PATH : &'static str = "../data/";

/* Handle a static-file request */
fn handle_file(_: Request, res: Response, filename: &str) {
    
    let path       = &(WEB_PATH.to_string() + filename);
    let f          = File::open(path).unwrap();
    let mut reader = BufReader::new(f);

    io::copy(&mut reader, &mut res.start().unwrap()).unwrap();
}

/* PUT a zip file */
fn handle_put(mut req: Request, res: Response, filename: &str) {
    let path       = &(ZIP_PATH.to_string() + filename);
    println!("Incoming file {}", path);
    let f =      OpenOptions::new()
                        .create(true)
                        .write(true)
                        .append(true)
                        .open(path)
                        .unwrap();

    let mut writer = BufWriter::new(f);
    io::copy(&mut req, &mut writer).unwrap();
}

/* GET a zip file */
fn handle_get(_: Request, res: Response, filename: &str) {
    let path       = &(ZIP_PATH.to_string() + filename);
    let f          = File::open(path).unwrap();
    let mut reader = BufReader::new(f);

    io::copy(&mut reader, &mut res.start().unwrap()).unwrap();
}

/* Main request dispatcher */
fn main_handler(req: Request, res: Response) {

    let uri:    &str   = &(req.uri.to_string());
    let prefix: &str   = if uri.len() <3 { "" } else { &(uri[0..3]) };
    let suffix: &str   = if uri.len() <3 { "" } else { &(uri[3..]) };
    let is_put: bool   = req.method == Method::Put;

    match uri {
        // subpages all goto index
        "/" | "/get" | "/put" | "/faq" | "/pay" 
            if !is_put           => handle_file(req, res, "/index.html"),

        // file PUT
        _ if prefix== "/f/" 
          && is_put              => handle_put(req, res, suffix),

        // file GET
        _ if prefix== "/f/" 
          && !is_put             => handle_get(req, res, suffix),

        // helper files (js/css)
        _                        => handle_file(req, res, uri)
    };
}

fn main() {
    let _listening = hyper::Server::http("127.0.0.1:3000")
        .unwrap()
        .handle(main_handler);

    println!("Listening on http://127.0.0.1:3000");
}


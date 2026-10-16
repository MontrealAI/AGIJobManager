'use strict';
// All writable operator state belongs outside the reviewed source checkout.
const fs=require('node:fs'),path=require('node:path'),T=require('./transaction-envelope.cjs');
const SOURCE_ROOT=path.resolve(__dirname,'../..');
function entryExists(file){try{fs.lstatSync(file);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}}
function outside(root,target){return target!==root&&!target.startsWith(root+path.sep);}
function requireExternalPath(input,{sourceRoot=SOURCE_ROOT,label='Operator path'}={}){
 T.need(typeof input==='string'&&input.length>0,`${label} is required.`);
 const root=fs.realpathSync(sourceRoot),absolute=path.resolve(input);
 T.need(outside(root,absolute),`${label} must be outside the reviewed source checkout.`);
 // An operator may select a new final component, but its parent must exist.
 // Reject aliases outright rather than relying on an unsafe lexical comparison.
 const parent=fs.realpathSync(path.dirname(absolute));
 T.need(outside(root,parent),`${label} resolves inside the reviewed source checkout.`);
 T.need(parent===path.dirname(absolute),`${label} parent must not traverse symlinks.`);
 try{const stat=fs.lstatSync(absolute);T.need(!stat.isSymbolicLink(),`${label} must not be a symlink.`);T.need(fs.realpathSync(absolute)===absolute,`${label} must be a real path.`);}catch(error){if(error.code!=='ENOENT')throw error;}
 return absolute;
}
function requireSessionPaths(directory,meta){
 const result=requireExternalPath(directory,{label:'Session journal'});
 if(meta){T.need(meta.creatorLock&&meta.creatorLock.journalPath===result,'Session lock journal binding differs.');requireExternalPath(meta.creatorLock.journalPath,{label:'Recorded journal'});requireExternalPath(meta.creatorLock.path,{label:'Creator lock'});requireExternalPath(path.dirname(meta.creatorLock.path),{label:'Shared lock directory'});for(const name of ['events','signed','attempts']){const child=requireExternalPath(path.join(result,name),{label:'Session '+name});T.need(fs.lstatSync(child).isDirectory(),'Session child must be a real directory.');}const active=path.join(result,'active-command');if(entryExists(active))requireExternalPath(active,{label:'Session command guard'});}
 return result;
}
module.exports={SOURCE_ROOT,requireExternalPath,requireSessionPaths,entryExists};

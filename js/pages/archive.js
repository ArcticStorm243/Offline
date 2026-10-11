/* pages/archive.js – ARCHIVE (cold storage). Uses the FileBrowser from files.js.
   #/archive         → listing
   #/archive/<id>    → record view
   New records appear via "when" conditions in data/files.json (Paket 5). */

Router.register('archive', FileBrowser.page({
  location: 'archive',
  title: 'ARCHIVE',
  intro: 'Cold storage – records older than the current node. Some segments are damaged.'
}));

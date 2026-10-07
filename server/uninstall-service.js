const Service = require('node-windows').Service;
const path = require('path');
const svc = new Service({
  name: 'NexFlowService',
  script: path.join(__dirname, 'src', 'index.js')
});
svc.on('uninstall', function() {
  console.log('NexFlowService uninstalled successfully!');
});
svc.uninstall();
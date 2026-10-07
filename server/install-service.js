import { Service } from 'node-windows';
import path from 'path';
import { fileURLToPath } from 'url';
// In ES modules, __dirname is not defined by default. Create it:
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Create a new service object
const svc = new Service({
  name: 'NexFlowService',
  description: 'NexFlow Express server as a Windows service',
  script: path.join(__dirname, 'src', 'index.js'),
  cwd: __dirname,
  // Optionally set nodeOptions if needed:
  // nodeOptions: ['--harmony', '--max_old_space_size=4096']
});
// Listen for the "install" event, which indicates the service is available
svc.on('install', () => {
  console.log('NexFlowService installed successfully!');
  svc.start();
});
svc.on('alreadyinstalled', () => {
  console.log('This service is already installed.');
});
// Install the service
svc.install();
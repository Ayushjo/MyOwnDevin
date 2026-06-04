import Docker from 'dockerode';
const docker = new Docker();

const portBindings = {
  '3000/tcp': [{ HostPort: '8000' }]
};


const container = await docker.createContainer({
  Image: 'your-image-name',
  AttachStdin: false,
  AttachStdout: true,
  AttachStderr: true,
  Tty: true,
  ExposedPorts: { '3000/tcp': {} },
  HostConfig: {
    PortBindings: portBindings
  }
});//creates the container

await container.start(); //starts the container
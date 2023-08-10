# Eclipse GLSP VS Code Integration [![Build Status](https://ci.eclipse.org/glsp/job/eclipse-glsp/job/glsp-vscode-integration/job/master/badge/icon)](https://ci.eclipse.org/glsp/job/eclipse-glsp/job/glsp-vscode-integration/job/master/)

This project contains the glue code necessary to diagram editors built with the [graphical language server platform (GLSP)](https://github.com/eclipse-glsp/glsp) with VS Code, as well as an example VS Code extension for the workflow diagram example for testing purposes.

## Workflow Diagram Example

The workflow diagram is a consistent example provided by all GLSP components.
The example implements a simple flow chart diagram editor with different types of nodes and edges (see screenshot below).
The example can be used to try out different GLSP features, as well as several available integrations with IDE platforms (Theia, VS Code, Eclipse, Standalone).
As the example is fully open source, you can also use it as a blueprint for a custom implementation of a GLSP diagram editor.
See [our project website](https://www.eclipse.org/glsp/documentation/#workflowoverview) for an overview of the workflow example and all components implementing it.

> _**Remark:**_ The workflow example is a fully dev example, as it combines a variety of integration and connectivity options to easily test the different use cases.
> However, it should not be used as a blueprint for your custom implementation, for this we recommend the [GLSP project templates](https://github.com/eclipse-glsp/glsp-examples/tree/master/project-templates) in the GLSP example repository.

<https://user-images.githubusercontent.com/588090/154449892-a9693efb-21f3-4105-85ae-dbf97fffd442.mp4>

### How to start the Workflow Diagram example?

Clone this repository and build the VS Code integration packages:

```bash
yarn install
```

Now you can start the VS Code extension by opening this repository in VS Code and executing the `Workflow GLSP Example Extension` launch configuration, provided with this project.

> A precompiled version of the Workflow Diagram Server will be launched automatically by the extension.
> To debug or modify the server and run it separately: see the instructions below.

### How to start the Workflow Diagram example server from the sources

If you want to explore or change the Workflow Diagram Server too, you can clone, build and start the Java or Node variant of the `workflow example glsp-server` from your IDE instead of using the pre-built version of the Workflow Diagram Server.
Checkout the [`glsp-server`](https://github.com/eclipse-glsp/glsp-server#workflow-diagram-example) or [`glsp-server-node`](https://github.com/eclipse-glsp/glsp-server-node#workflow-diagram-example) repo for instructions on building and running the Workflow Diagram Server example.

To test the VS Code extension with an external server (e.g started from your IDE) the launch configuration `Workflow GLSP Example Extension (External GLSP Server)` can be used.

### Start Workflow Diagram example in WebSocket mode

The default example use case uses a socket communication from the extension to the GLSP server.
To communicate with the server via WebSockets, the `Workflow GLSP Example Extension (Websocket)` launch configuration can be used.
This launch config establishes a connection to the server via the endpoint `ws://localhost:8081/workflow`.
To test the websocket connection with an external server the `Workflow GLSP Example Extension (External WebSocket GLSP Server)` launch config can be used

### Start Workflow Diagram example without a dedicated server process

The default example use case uses a socket communication from the extension to a GLSP server process.
To directly start the server in the extension context without an extra process, the `Workflow GLSP Example Extension (Integrated Node GLSP Server)` launch configuration can be used.

### Start Workflow Diagram example as a Web extension

In addition to a classic node-based VS Code extension, it is also possible to start the Workflow Diagram example as a VS Code web extension.
For this, the `Workflow GLSP Example Web Extension` launch configuration can be used.
Per default, this extension starts the GLSP server within the extension context and uses direct communication without json-rpc.
In addition, it is also possible to use an external GLSP server via WebSocket. To use this approach simply start a Workflow GLSP server that is listening on `ws://localhost:8081/workflow` (default websocket config for the Workflow example server) and then start the web extension via `Workflow GLSP Example Web Extension` launch configuration.
When available (i.e. the websocket address is reachable) the extension will automatically use the external server instead of the default in-context server.

> _**Remark:**_ In production, one would decide for one way of connectivity, and would not implement all the different options as we do in the workflow diagram example.
> This was setup to easily show and switch between the different possibilities.

### Where to find the sources?

In addition to this repository, the related source code can be found here:

-   <https://github.com/eclipse-glsp/glsp-server>
-   <https://github.com/eclipse-glsp/glsp-server-node>
-   <https://github.com/eclipse-glsp/glsp-client>

## More information

For more information, please visit the [Eclipse GLSP Umbrella repository](https://github.com/eclipse-glsp/glsp) and the [Eclipse GLSP Website](https://www.eclipse.org/glsp/).
If you have questions, please raise them in the [discussions](https://github.com/eclipse-glsp/glsp/discussions) and have a look at our [communication and support options](https://www.eclipse.org/glsp/contact/).

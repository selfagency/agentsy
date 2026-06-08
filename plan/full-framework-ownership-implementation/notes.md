# Notes: Full framework ownership implementation

## Constraints

- One integrated batch; no PR slicing.
- Keep @agentsy/context a library package.
- Move setup/doctor ownership to @agentsy/cli.
- Keep host-specific logic in outer-layer packages.

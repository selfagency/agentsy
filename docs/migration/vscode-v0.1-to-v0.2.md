# @agentsy/vscode migration from v0.1.x to 0.2.x

This guide outlines the major changes and migration steps when upgrading Agentsy's `@agentsy/vscode` package from version 0.1.x to 0.2.x.

## Breaking Changes

- Package structure reorganized for better modularity and package boundaries
- Improved separation between core utilities and VS Code-specific integration
- Enhanced streaming and retry mechanisms for better resilience
- Updated agent loop creation methods for more flexible integration

## Migration Steps

This version includes mainly internal improvements with minimal breaking changes for existing consumers.

1. Review your current imports and verify they work correctly:

```typescript
// Most existing imports should continue to work without changes
import { createVSCodeChatRenderer } from '@agentsy/vscode';
```

2. If you encounter any issues, consult the updated package documentation.

3. Test your extension thoroughly after upgrading to ensure compatibility.

## Notes

- Focus on stability and improved internal architecture
- Enhanced streaming capabilities for better performance and reliability
- Improved error handling and retry mechanisms
- More flexible agent loop creation methods

---

This migration guide will be updated with additional details as the v0.2.0 release matures.

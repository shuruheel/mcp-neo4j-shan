// This file is maintained for compatibility with existing build processes
// The actual implementation has been moved to the main/ directory

// Re-export and run the main function from the new location
import { main } from './main/index.js';

// Execute the main function
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
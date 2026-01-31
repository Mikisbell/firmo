# Requirements Document

## Introduction

This specification defines the complete CRUD (Create, Read, Update, Delete) functionality for the PARK POS Admin Panel. Currently, several admin modules only support read operations (GET/list view). This feature will implement full CRUD capabilities for Employees, Products, Promotions, Drivers, and Configuration modules, enabling administrators to manage all system data through the web interface.

## Glossary

- **Admin_Panel**: Web-based administrative interface for managing PARK POS system data
- **CRUD**: Create, Read, Update, Delete operations for data management
- **Employee**: System user with assigned role and PIN for authentication
- **Product**: Menu item with SKU, price, category, and station assignment
- **Promotion**: Discount or special offer with rules and validity period
- **Driver**: Delivery personnel assigned to delivery orders
- **Soft_Delete**: Deactivation of records by setting is_active flag to false
- **PIN**: 4-6 digit numeric code for employee authentication
- **SKU**: Stock Keeping Unit, unique identifier for products
- **Centavos**: Integer representation of money (cents), never float
- **Audit_Trail**: Log of all administrative actions for security and compliance
- **Modal_Form**: Overlay dialog for data entry and editing
- **Tenant**: Multi-tenant isolation identifier for data segregation

## Requirements

### Requirement 1: Employee CRUD Operations

**User Story:** As an administrator, I want to create, edit, and deactivate employees, so that I can manage system access and user accounts.

#### Acceptance Criteria

1. WHEN an administrator creates a new employee, THE Admin_Panel SHALL validate that the PIN is unique within the tenant
2. WHEN an administrator creates a new employee, THE Admin_Panel SHALL hash the PIN before storage using SHA-256 with salt
3. WHEN an administrator edits an employee, THE Admin_Panel SHALL allow changing name, role, and active status but not PIN
4. WHEN an administrator deactivates an employee, THE Admin_Panel SHALL perform a soft delete by setting is_active to false
5. THE Admin_Panel SHALL validate that employee role is one of: OWNER, ADMIN, MANAGER, CASHIER, WAITER, KITCHEN, DRIVER
6. WHEN an employee is created or modified, THE Admin_Panel SHALL log the action in the audit trail
7. THE Admin_Panel SHALL display a confirmation dialog before deactivating an employee
8. WHEN displaying the employee list, THE Admin_Panel SHALL show name, role, and active status

### Requirement 2: Product CRUD Operations

**User Story:** As an administrator, I want to create, edit, and deactivate products, so that I can maintain an up-to-date menu.

#### Acceptance Criteria

1. WHEN an administrator creates a new product, THE Admin_Panel SHALL validate that the SKU is unique within the tenant
2. WHEN an administrator creates or edits a product, THE Admin_Panel SHALL store price as integer centavos, never as float
3. WHEN an administrator edits a product, THE Admin_Panel SHALL allow changing all fields including SKU, name, price, category, station, and active status
4. WHEN an administrator deactivates a product, THE Admin_Panel SHALL perform a soft delete by setting is_active to false
5. THE Admin_Panel SHALL validate that product category is one of: POLLOS, PARRILLAS, BEBIDAS, EXTRAS, POSTRES, COMBOS
6. THE Admin_Panel SHALL validate that product station is one of: PARRILLA, COCINA, BAR, HORNO, POSTRES, EMPAQUE
7. WHEN a product is created or modified, THE Admin_Panel SHALL increment the catalog_version counter
8. WHEN a product is created or modified, THE Admin_Panel SHALL log the action in the audit trail
9. THE Admin_Panel SHALL display a confirmation dialog before deactivating a product
10. WHEN displaying the product list, THE Admin_Panel SHALL show SKU, name, price, category, station, and active status

### Requirement 3: Promotion CRUD Operations

**User Story:** As an administrator, I want to create, edit, and deactivate promotions, so that I can manage discounts and special offers.

#### Acceptance Criteria

1. WHEN an administrator creates a new promotion, THE Admin_Panel SHALL validate that start_date is before end_date
2. WHEN an administrator creates or edits a promotion, THE Admin_Panel SHALL validate that type is one of: PERCENT, FIXED, 2X1, HAPPY_HOUR, COMBO
3. WHEN an administrator edits a promotion, THE Admin_Panel SHALL allow changing all fields including name, type, value, dates, rules, and active status
4. WHEN an administrator deactivates a promotion, THE Admin_Panel SHALL perform a soft delete by setting is_active to false
5. THE Admin_Panel SHALL automatically deactivate promotions when end_date is reached
6. WHEN a promotion is created or modified, THE Admin_Panel SHALL log the action in the audit trail
7. THE Admin_Panel SHALL display a confirmation dialog before deactivating a promotion
8. WHEN displaying the promotion list, THE Admin_Panel SHALL show name, type, value, validity period, and expiration status
9. THE Admin_Panel SHALL allow editing promotion rules as JSON with validation

### Requirement 4: Driver CRUD Operations

**User Story:** As an administrator, I want to create, edit, and deactivate drivers, so that I can manage delivery personnel.

#### Acceptance Criteria

1. WHEN an administrator creates a new driver, THE Admin_Panel SHALL require name and allow optional phone number
2. WHEN an administrator edits a driver, THE Admin_Panel SHALL allow changing name, phone, and active status
3. WHEN an administrator deactivates a driver, THE Admin_Panel SHALL perform a soft delete by setting is_active to false
4. WHEN a driver is created or modified, THE Admin_Panel SHALL log the action in the audit trail
5. THE Admin_Panel SHALL display a confirmation dialog before deactivating a driver
6. WHEN displaying the driver list, THE Admin_Panel SHALL show name, phone, and active status

### Requirement 5: Configuration Edit Operations

**User Story:** As an administrator, I want to edit system configuration, so that I can customize system behavior and settings.

#### Acceptance Criteria

1. WHEN an administrator edits tenant settings, THE Admin_Panel SHALL validate all configuration values before saving
2. WHEN an administrator edits system parameters, THE Admin_Panel SHALL require confirmation for critical settings
3. WHEN configuration is modified, THE Admin_Panel SHALL log the action in the audit trail with old and new values
4. THE Admin_Panel SHALL display current configuration values in an editable form
5. THE Admin_Panel SHALL validate that numeric configuration values are within acceptable ranges

### Requirement 6: Form Validation and User Experience

**User Story:** As an administrator, I want clear validation and feedback, so that I can avoid data entry errors.

#### Acceptance Criteria

1. WHEN form validation fails, THE Admin_Panel SHALL display specific error messages for each invalid field
2. WHEN a save operation is in progress, THE Admin_Panel SHALL display a loading indicator and disable the submit button
3. WHEN a save operation succeeds, THE Admin_Panel SHALL close the form and refresh the data list
4. WHEN a save operation fails, THE Admin_Panel SHALL display the error message without closing the form
5. THE Admin_Panel SHALL validate required fields on both client and server side
6. WHEN displaying forms, THE Admin_Panel SHALL use modal dialogs for create and edit operations
7. THE Admin_Panel SHALL follow the existing design pattern from the Mesas module

### Requirement 7: Permission and Security

**User Story:** As a system administrator, I want CRUD operations to be restricted by role, so that only authorized users can modify data.

#### Acceptance Criteria

1. THE Admin_Panel SHALL restrict all create, update, and delete operations to users with ADMIN or MANAGER roles
2. WHEN an unauthorized user attempts a restricted operation, THE Admin_Panel SHALL return a 403 Forbidden error
3. THE Admin_Panel SHALL validate user permissions on both client and server side
4. WHEN logging audit trail entries, THE Admin_Panel SHALL record the actor_id and terminal_id

### Requirement 8: Data Integrity and Consistency

**User Story:** As a system administrator, I want data operations to maintain integrity, so that the system remains consistent.

#### Acceptance Criteria

1. WHEN creating or updating records, THE Admin_Panel SHALL use database transactions to ensure atomicity
2. WHEN validation fails, THE Admin_Panel SHALL rollback any partial changes
3. THE Admin_Panel SHALL enforce foreign key constraints for related data
4. WHEN soft deleting records, THE Admin_Panel SHALL check for dependent records and warn the user
5. THE Admin_Panel SHALL prevent deletion of records that are currently in use

### Requirement 9: Offline-First Considerations

**User Story:** As an administrator, I want CRUD operations to work offline when possible, so that I can manage data without constant connectivity.

#### Acceptance Criteria

1. WHEN creating or editing records offline, THE Admin_Panel SHALL queue the operations for later synchronization
2. WHEN connectivity is restored, THE Admin_Panel SHALL automatically sync queued operations
3. THE Admin_Panel SHALL display sync status indicators for pending operations
4. WHEN conflicts occur during sync, THE Admin_Panel SHALL use server state as the source of truth for admin operations

### Requirement 10: API Endpoints

**User Story:** As a developer, I want consistent RESTful API endpoints, so that I can integrate with the admin panel.

#### Acceptance Criteria

1. THE Admin_Panel SHALL implement POST /api/admin/employees for creating employees
2. THE Admin_Panel SHALL implement PUT /api/admin/employees/[id] for updating employees
3. THE Admin_Panel SHALL implement DELETE /api/admin/employees/[id] for deactivating employees
4. THE Admin_Panel SHALL implement POST /api/admin/products for creating products
5. THE Admin_Panel SHALL implement PUT /api/admin/products/[id] for updating products
6. THE Admin_Panel SHALL implement DELETE /api/admin/products/[id] for deactivating products
7. THE Admin_Panel SHALL implement POST /api/admin/promotions for creating promotions
8. THE Admin_Panel SHALL implement PUT /api/admin/promotions/[id] for updating promotions
9. THE Admin_Panel SHALL implement DELETE /api/admin/promotions/[id] for deactivating promotions
10. THE Admin_Panel SHALL implement POST /api/drivers for creating drivers
11. THE Admin_Panel SHALL implement PUT /api/drivers/[id] for updating drivers
12. THE Admin_Panel SHALL implement DELETE /api/drivers/[id] for deactivating drivers
13. THE Admin_Panel SHALL implement PUT /api/admin/config for updating configuration
14. WHEN API operations succeed, THE Admin_Panel SHALL return appropriate HTTP status codes (200, 201, 204)
15. WHEN API operations fail, THE Admin_Panel SHALL return appropriate error codes (400, 403, 404, 409, 500) with descriptive messages

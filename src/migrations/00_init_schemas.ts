import { QueryInterface, DataTypes } from "sequelize";

export async function up(queryInterface: QueryInterface): Promise<void> {
  // Create Employees table
  await queryInterface.createTable("Employees", {
    id: { type: DataTypes.STRING, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    code: { type: DataTypes.STRING, allowNull: false, unique: true },
    department: { type: DataTypes.STRING, allowNull: false },
    designation: { type: DataTypes.STRING, allowNull: false },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false }
  });

  // Create Orders table
  await queryInterface.createTable("Orders", {
    id: { type: DataTypes.STRING, primaryKey: true },
    orderNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
    productName: { type: DataTypes.STRING, allowNull: false },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false }
  });

  // Create Assignments table
  await queryInterface.createTable("Assignments", {
    id: { type: DataTypes.STRING, primaryKey: true },
    employeeId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: { model: "Employees", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE"
    },
    orderId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: { model: "Orders", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE"
    },
    assignedDate: { type: DataTypes.STRING, allowNull: false },
    notes: { type: DataTypes.TEXT, allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false }
  });

  // Create AttendanceLogs table
  await queryInterface.createTable("AttendanceLogs", {
    id: { type: DataTypes.STRING, primaryKey: true },
    employeeId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: { model: "Employees", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE"
    },
    date: { type: DataTypes.STRING, allowNull: false },
    checkIn: { type: DataTypes.STRING, allowNull: true },
    checkOut: { type: DataTypes.STRING, allowNull: true },
    status: { type: DataTypes.STRING, allowNull: false },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false }
  });

  // Create Timesheets table
  await queryInterface.createTable("Timesheets", {
    id: { type: DataTypes.STRING, primaryKey: true },
    employeeId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: { model: "Employees", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE"
    },
    date: { type: DataTypes.STRING, allowNull: false },
    submittedAt: { type: DataTypes.STRING, allowNull: false },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false }
  });

  // Create TimesheetEntries table
  await queryInterface.createTable("TimesheetEntries", {
    id: { type: DataTypes.STRING, primaryKey: true },
    timesheetId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: { model: "Timesheets", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE"
    },
    orderId: {
      type: DataTypes.STRING,
      allowNull: true,
      references: { model: "Orders", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE"
    },
    description: { type: DataTypes.TEXT, allowNull: false },
    hours: { type: DataTypes.FLOAT, allowNull: false },
    images: { type: DataTypes.TEXT, allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false }
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable("TimesheetEntries");
  await queryInterface.dropTable("Timesheets");
  await queryInterface.dropTable("AttendanceLogs");
  await queryInterface.dropTable("Assignments");
  await queryInterface.dropTable("Orders");
  await queryInterface.dropTable("Employees");
}

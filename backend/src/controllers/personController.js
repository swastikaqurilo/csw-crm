const Person = require("../models/Person");

const createPerson = async (req, res) => {
  try {
    const {
      name,
      phone,
      type,
      role,
      joiningDate,
      salary,
      dailyWage,
      status,
    } = req.body;

    if (!name || !type || !joiningDate) {
      return res.status(400).json({
        success: false,
        message: "Name, type and joining date are required",
      });
    }

    if (
      type === "Employee" &&
      (salary === undefined || salary === null)
    ) {
      return res.status(400).json({
        success: false,
        message: "Salary is required for an employee",
      });
    }

    if (
      type === "Factory People" &&
      (dailyWage === undefined || dailyWage === null)
    ) {
      return res.status(400).json({
        success: false,
        message: "Daily wage is required for factory people",
      });
    }

    const person = await Person.create({
      name,
      phone,
      type,
      role,
      joiningDate,
      salary: type === "Employee" ? salary : null,
      dailyWage: type === "Factory People" ? dailyWage : null,
      status: status || "Active",
    });

    res.status(201).json({
      success: true,
      message: "Person created successfully",
      data: person,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create person",
      error: error.message,
    });
  }
};

const getPeople = async (req, res) => {
  try {
    const { type, status } = req.query;

    const filter = {};

    if (type) {
      filter.type = type;
    }

    if (status) {
      filter.status = status;
    }

    const people = await Person.find(filter).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      count: people.length,
      data: people,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch people",
      error: error.message,
    });
  }
};

const getPerson = async (req, res) => {
  try {
    const person = await Person.findById(req.params.id);

    if (!person) {
      return res.status(404).json({
        success: false,
        message: "Person not found",
      });
    }

    res.status(200).json({
      success: true,
      data: person,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch person",
      error: error.message,
    });
  }
};

const updatePerson = async (req, res) => {
  try {
    const person = await Person.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!person) {
      return res.status(404).json({
        success: false,
        message: "Person not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Person updated successfully",
      data: person,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update person",
      error: error.message,
    });
  }
};

const deletePerson = async (req, res) => {
  try {
    const person = await Person.findById(req.params.id);

    if (!person) {
      return res.status(404).json({
        success: false,
        message: "Person not found",
      });
    }

    // Keep the person because old expense records may reference them.
    person.status = "Inactive";
    await person.save();

    res.status(200).json({
      success: true,
      message: "Person marked as inactive",
      data: person,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to deactivate person",
      error: error.message,
    });
  }
};

module.exports = {
  createPerson,
  getPeople,
  getPerson,
  updatePerson,
  deletePerson,
};
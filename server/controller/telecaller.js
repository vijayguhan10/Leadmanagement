const telecallerSchema = require("../schema/telecallerschema");
const Lead = require("../schema/leadschema");
const {getDatabaseConnection} = require('../config/db'); 
const bcrypt=require("bcrypt")
const jwt = require('jsonwebtoken');

const updateLeadResult = async (req, res) => {
    try {
        const { telecallerId, leadId, action, notes } = req.body;

        if (!telecallerId || !leadId || !action) {
            return res.status(400).json({ message: "Telecaller ID, Lead ID, and action are required." });
        }

        const telecaller = await req.db.Telecaller.findById(telecallerId);
        if (!telecaller) {
            return res.status(404).json({ message: "Telecaller not found." });
        }

        const lead = await req.db.Lead.findById(leadId);
        if (!lead) {
            return res.status(404).json({ message: "Lead not found." });
        }

        const validStatuses = ["unassigned", "warm", "cold", "hot", "fulfilled"];
        if (!validStatuses.includes(action)) {
            return res.status(400).json({ message: `Invalid action provided. Valid actions: ${validStatuses.join(", ")}.` });
        }

        lead.status = action;
        await lead.save();

        telecaller.history.push({
            leadId: lead._id,
            action,
            notes,
        });

        await telecaller.save();

        res.status(200).json({ message: "Lead result updated successfully.", lead });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error updating lead result.", error: err });
    }
};

const getAssignedLeads = async (req, res) => {
    try {
        const { telecallerId } = req.params;

        const telecaller = await req.db.Telecaller.findById(telecallerId).populate("leads");
        if (!telecaller) {
            return res.status(404).json({ message: "Telecaller not found." });
        }

        res.status(200).json({ leads: telecaller.leads });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching assigned leads.", error: err });
    }
};

const getTelecallerHistory = async (req, res) => {
    try {
        const { telecallerId } = req.params;

        const telecaller = await req.db.Telecaller.findById(telecallerId).populate("history.leadId");
        if (!telecaller) {
            return res.status(404).json({ message: "Telecaller not found." });
        }

        res.status(200).json({ history: telecaller.history });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching telecaller history.", error: err });
    }
};
const login = async (req, res) => {
    const { email, password } = req.body;
    console.log("😎😎",req.body);

    if (!email || !password) {
        return res.status(400).json({ message: "Please provide email and password." });
    }

    try {
        const Admin = req.db.model('Admin');
        const admin = await Admin.findOne({ "telecallers.email": email });

        if (!admin) {
            return res.status(401).json({ message: "Admin not found." });
        }

        const telecaller = admin.telecallers.find(tc => tc.email === email);

        if (!telecaller) {
            return res.status(401).json({ message: "Telecaller not found." });
        }

        const adminDbConnection = await getDatabaseConnection(admin.databaseName);

        const TelecallerModel = adminDbConnection.model('Telecaller', telecallerSchema);

        const foundTelecaller = await TelecallerModel.findOne({ email });

        if (!foundTelecaller) {
            return res.status(401).json({ message: "Telecaller not found in admin's database." });
        }

        const isMatch = await bcrypt.compare(password, foundTelecaller.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials." });
        }

        const databaseName = admin.databaseName;

        console.log("Database Name:", databaseName);

        const token = jwt.sign({ telecallerId: foundTelecaller._id, databaseName, role: "telecaller" }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({ message: "Login successful", token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error logging in", error: err });
    }
};



module.exports = {
    updateLeadResult,
    getAssignedLeads,
    getTelecallerHistory,
    login
};

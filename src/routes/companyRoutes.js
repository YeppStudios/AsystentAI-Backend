const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const requireAuth = require('../middlewares/requireAuth');
const User = mongoose.model('User');
const Workspace = mongoose.model('Workspace');

function generateApiKey() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let apiKey = '';
    for (let i = 0; i < 32; i++) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      apiKey += chars[randomIndex];
    }
    return apiKey;
  }

router.post('workspaces/add', requireAuth, async (req, res) => {
  const companyId = req.user._id;
  if (req.user.accountType === "compnay") {
    try {
      const { admins, employees } = req.body;
      const apiKey = generateApiKey(); // generate an API key
      const workspace = new Workspace({ 
        admins: [...admins, companyId], // add the company ID as an admin
        company: companyId, // set the company ID
        employees,
        apiKey // set the generated API key
      });
      await workspace.save();
      res.status(201).json(workspace);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to create workspace' });
    }
  }
});

router.get('/workspace', requireAuth, async (req, res) => {

  try {
    const workspace = await Workspace.findById(req.user.workspace).populate('admins', 'email').populate('employees.user', 'email').exec();
    res.json(workspace);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});

router.post('/send-invitation', requireAuth, async (req, res) => {
    const { email, role } = req.body;
    const invitedBy = req.user._id;
    const workspace = await Workspace.findOne({ company: invitedBy });

    if (!workspace) {
        return res.status(404).json({ error: 'Workspace not found' });
    }

    const companyAdmins = workspace.admins.filter(id => id.toString() === req.user._id.toString());
    if (companyAdmins.length === 0) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const code = generateApiKey();
    workspace.invitations.push({ email, code, role, invitedBy });
    await workspace.save();

    const inviteUrl = `https://www.asystent.ai/contentcreator?registration=true&workspace=${workspace._id}&code=${code}`;


    res.status(201).json({ invitationLink: inviteUrl });
});

router.put('/workspaces/:id/add-admin', requireAuth, async (req, res) => {
    const workspaceId = req.params.id;
    const adminId= req.body.id;
  
    try {
      const workspace = await Workspace.findById(workspaceId);
      if (!workspace) {
        return res.status(404).json({ error: 'Workspace not found' });
      }
  
      const companyAdmins = workspace.admins.filter(id => id.toString() === req.user._id.toString());
      if (companyAdmins.length === 0) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
  
      if (workspace.admins.includes(adminId)) {
        return res.status(400).json({ error: 'Admin already exists' });
      }
  
      workspace.admins.push(adminId);
      await workspace.save();
      res.json(workspace);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to add admin' });
    }
  });

router.post('/workspaces/:id/add-employee', requireAuth, async (req, res) => {
    const workspaceId = req.params.id;
    const { userId, role } = req.body;
  
    try {
      const workspace = await Workspace.findById(workspaceId);
      if (!workspace) {
        return res.status(404).json({ error: 'Workspace not found' });
      }
  
      const companyAdmins = workspace.admins.filter(id => id.toString() === req.user._id.toString());
      if (companyAdmins.length === 0) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
  
      const existingEmployee = workspace.employees.find(employee => employee.user.toString() === userId.toString());
      if (existingEmployee) {
        return res.status(400).json({ error: 'Employee already added to workspace' });
      }
  
      workspace.employees.push({ user: userId, role });
      await workspace.save();
      res.json(workspace);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to add employee' });
    }
  });
  
  
// Remove an employee from a workspace
router.put('/workspaces/:id/remove-employee', requireAuth, async (req, res) => {
    const workspaceId = req.params.id;
    const { userId } = req.body;
  
    try {
      const workspace = await Workspace.findById(workspaceId);
      if (!workspace) {
        return res.status(404).json({ error: 'Workspace not found' });
      }
  
      const companyAdmins = workspace.admins.filter(id => id.toString() === req.user._id.toString());
      if (companyAdmins.length === 0) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
  
      const employeeIndex = workspace.employees.findIndex(employee => employee.user.toString() === userId.toString());
      if (employeeIndex === -1) {
        return res.status(404).json({ error: 'Employee not found in workspace' });
      }
  
      workspace.employees.splice(employeeIndex, 1);
      await workspace.save();
      res.json(workspace);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to remove employee' });
    }
  });
  
  // Remove an admin from a workspace
router.put('/workspaces/:id/remove-admin', requireAuth, async (req, res) => {
    const workspaceId = req.params.id;
    const { adminId } = req.body;
  
    try {
      const workspace = await Workspace.findById(workspaceId);
      if (!workspace) {
        return res.status(404).json({ error: 'Workspace not found' });
      }
  
      const companyAdmins = workspace.admins.filter(id => id.toString() === req.user._id.toString());
      if (companyAdmins.length === 0) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
  
      if (workspace.admins.length === 1) {
        return res.status(400).json({ error: 'Cannot remove the only admin' });
      }
  
      const index = workspace.admins.indexOf(adminId);
      if (index === -1) {
        return res.status(400).json({ error: 'Admin not found' });
      }
  
      workspace.admins.splice(index, 1);
      await workspace.save();
      res.json(workspace);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to remove admin' });
    }
  });

  
module.exports = router;
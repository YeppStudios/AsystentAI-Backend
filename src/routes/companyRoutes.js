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

router.get('/workspace-company/:workspaceId', async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;

    const workspace = await Workspace.findById(workspaceId)
      .populate({
        path: 'company',
        select: 'name email tokenBalance',
      });

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    return res.status(200).json({ company: workspace.company });

  } catch (error) {
    console.log(error);
    return res.status(500).json({ error });
  }
});


router.get('/workspace', requireAuth, async (req, res) => {

  try {
    const workspace = await Workspace.findOne({ company: req.user._id }).populate('admins', 'email').populate('employees.user', 'email').exec();

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    res.json(workspace);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});

router.post('/send-invitation', requireAuth, async (req, res) => {
  const { email, role } = req.body;
  const invitedBy = req.user._id;
  const workspace = await Workspace.findOne({ company: req.user._id });

  if (!workspace) {
    return res.status(404).json({ error: 'Workspace not found' });
  }

  const companyAdmins = workspace.admins.filter(id => id.toString() === req.user._id.toString());
  if (companyAdmins.length === 0) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check if invitation for this email already exists
  const existingInvitation = workspace.invitations.find(invitation => invitation.email === email);
  if (existingInvitation) {
    return res.status(400).json({ error: 'Invitation already sent to this email' });
  }

  workspace.invitations.push({ email, role, invitedBy });
  await workspace.save();

  const inviteUrl = `https://www.asystent.ai/contentcreator?registration=true&workspace=${workspace._id}`;

  return res.status(201).json({ invitationLink: inviteUrl });
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
router.delete('/workspaces/:id/delete-employee/:userEmail', requireAuth, async (req, res) => {
  const workspaceId = req.params.id;
  const userEmail = req.params.userEmail;

  try {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const companyAdmins = workspace.admins.filter(id => id.toString() === req.user._id.toString());
    if (companyAdmins.length === 0) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const employeeIndex = workspace.employees.findIndex(employee => employee.email === userEmail);
    if (employeeIndex === -1) {
      return res.status(404).json({ error: 'Employee not found in workspace' });
    }

    const employee = workspace.employees[employeeIndex];

    // Set the workspace field of the user to null
    await User.findOneAndUpdate({ email: employee.email }, { workspace: "" });

    workspace.employees.splice(employeeIndex, 1);
    await workspace.save();
    return res.json(workspace);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to remove employee' });
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

  router.get('/invitatations', requireAuth, async (req, res) => {
    try {
      const workspace = await Workspace.findOne({ company: req.user._id });
  
      if (!workspace) {
        return res.status(404).json({ error: 'Workspace not found' });
      }
  
      const invitations = workspace.invitations;
      return res.json({ invitations });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  
module.exports = router;
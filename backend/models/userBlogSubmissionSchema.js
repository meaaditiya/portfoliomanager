const mongoose = require('mongoose');
const userBlogSubmissionSchema = new mongoose.Schema({
    
    userName: {
      type: String,
      required: true,
      trim: true
    },
    userEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    
    
    title: { 
      type: String, 
      required: true,
      trim: true
    },
    content: { 
      type: String, 
      required: true 
    },
    
    
    contentImages: [{
      url: {
        type: String,
        required: true
      },
      alt: {
        type: String,
        default: ''
      },
      caption: {
        type: String,
        default: ''
      },
      position: {
        type: String,
        enum: ['left', 'right', 'center', 'full-width'],
        default: 'center'
      },
      imageId: {
        type: String,
        required: true
      }
    }],
    
    
    contentVideos: [{
      url: {
        type: String,
        required: true
      },
      videoId: {
        type: String,
        required: true
      },
      platform: {
        type: String,
        enum: ['youtube', 'vimeo', 'dailymotion'],
        default: 'youtube'
      },
      title: {
        type: String,
        default: ''
      },
      caption: {
        type: String,
        default: ''
      },
      position: {
        type: String,
        enum: ['left', 'right', 'center', 'full-width'],
        default: 'center'
      },
      autoplay: {
        type: Boolean,
        default: false
      },
      muted: {
        type: Boolean,
        default: false
      },
      embedId: {
        type: String,
        required: true
      }
    }],
    
    summary: {
      type: String,
      trim: true,
      maxlength: 200
    },
    
    tags: [{ 
      type: String, 
      trim: true 
    }],
    
    featuredImage: { 
      type: String,
      required: true
    },
    
    
    blogSubmissionId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true
    },
    
    status: { 
      type: String, 
      enum: ['pending', 'approved', 'rejected'], 
      default: 'pending' 
    },
    
    
    rejectionReason: {
      type: String,
      trim: true,
      default: ''
    },
    
    
    changesSuggested: {
      type: String,
      trim: true,
      default: ''
    },
    
    
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Admin'
    },
    
    reviewedAt: {
      type: Date
    },
    
    
    publishedBlogId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Blog'
    },
    
    
    submittedAt: { 
      type: Date, 
      default: Date.now 
    },
    updatedAt: { 
      type: Date, 
      default: Date.now 
    }
});


function generateBlogSubmissionId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let submissionId = 'BSI-'; 
  
  
  for (let i = 0; i < 12; i++) {
    submissionId += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return submissionId;
}


userBlogSubmissionSchema.pre('validate', async function(next) {
  if (!this.blogSubmissionId) {
    let isUnique = false;
    let submissionId;

    while (!isUnique) {
      submissionId = generateBlogSubmissionId();
      const existingSubmission = await mongoose.models.UserBlogSubmission.findOne({
        blogSubmissionId: submissionId
      });

      if (!existingSubmission) {
        isUnique = true;
      }
    }

    this.blogSubmissionId = submissionId;
  }
  next();
});


userBlogSubmissionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const UserBlogSubmission = mongoose.model('UserBlogSubmission', userBlogSubmissionSchema);

module.exports = UserBlogSubmission;